import numpy as np
import random
from datetime import datetime
from app.rl.env import HospitalQueueEnv
from app.db import get_db_conn

class QLearningAgent:
    def __init__(self, alpha: float = 0.1, gamma: float = 0.9, epsilon: float = 0.2):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.num_actions = 4
        # State: eq(6), uq(6), rq(6), busy(2) -> 432 states
        self.q_table = np.zeros((432, self.num_actions))

    def _state_to_idx(self, state_tuple: tuple) -> int:
        eq, uq, rq, busy = state_tuple
        return eq * 72 + uq * 12 + rq * 2 + busy

    def choose_action(self, state_tuple: tuple, epsilon: float = None) -> int:
        eps = epsilon if epsilon is not None else self.epsilon
        if random.random() < eps:
            return random.randint(0, self.num_actions - 1)
        
        state_idx = self._state_to_idx(state_tuple)
        return int(np.argmax(self.q_table[state_idx]))

    def train(self, episodes: int = 200) -> list:
        env = HospitalQueueEnv()
        history = []
        
        # Connect to DB to save metrics
        conn = get_db_conn()
        cursor = conn.cursor()
        
        # Reset table for fresh graph
        cursor.execute("DELETE FROM rl_metrics")
        conn.commit()

        epsilon = 1.0
        min_epsilon = 0.1
        decay_rate = 0.02

        for ep in range(1, episodes + 1):
            state = env.reset()
            done = False
            total_reward = 0.0
            total_waiting = 0
            steps = 0
            busy_steps = 0
            
            while not done:
                action = self.choose_action(state, epsilon)
                next_state, reward, done, info = env.step(action)
                
                # Q-learning Update
                state_idx = self._state_to_idx(state)
                next_state_idx = self._state_to_idx(next_state)
                
                best_next_action = np.argmax(self.q_table[next_state_idx])
                
                # Bellman equation
                self.q_table[state_idx, action] += self.alpha * (
                    reward + self.gamma * self.q_table[next_state_idx, best_next_action] - self.q_table[state_idx, action]
                )
                
                state = next_state
                total_reward += reward
                total_waiting += info["waiting_count"]
                steps += 1
                if info["utilization"] > 0:
                    busy_steps += 1
            
            # Epsilon decay
            epsilon = max(min_epsilon, epsilon - decay_rate)
            
            avg_wait = total_waiting / steps
            utilization = (busy_steps / steps) * 100.0
            
            history.append({
                "episode": ep,
                "reward": total_reward,
                "avg_wait": avg_wait,
                "utilization": utilization
            })
            
            # Log to DB every few episodes to show real-time progress on frontend
            if ep % 5 == 0 or ep == 1:
                cursor.execute(
                    "INSERT INTO rl_metrics (episode, average_waiting_time, resource_utilization, reward, timestamp) VALUES (?, ?, ?, ?, ?)",
                    (ep, avg_wait, utilization, total_reward, datetime.now().isoformat())
                )
                conn.commit()
                
        conn.close()
        return history

    def evaluate_policies(self, num_episodes: int = 20) -> dict:
        """
        Compare three scheduling policies:
        - Random
        - FIFO (Process highest priority queue first)
        - RL Optimized (Using Q-table)
        """
        env = HospitalQueueEnv()
        policies = ["Random", "FIFO", "RL_Optimized"]
        results = {p: {"avg_wait": [], "emergency_wait": [], "utilization": []} for p in policies}
        
        for policy in policies:
            for _ in range(num_episodes):
                state_tuple = env.reset()
                done = False
                total_wait = 0
                em_wait = 0
                busy_steps = 0
                steps = 0
                
                while not done:
                    eq, uq, rq, busy = env.state
                    
                    # Policy Action Selection
                    if policy == "Random":
                        action = random.randint(0, 3)
                    elif policy == "FIFO":
                        # High priority first heuristic
                        if busy == 1:
                            action = 0 # Idle
                        elif eq > 0:
                            action = 1
                        elif uq > 0:
                            action = 2
                        elif rq > 0:
                            action = 3
                        else:
                            action = 0
                    else: # RL_Optimized
                        action = self.choose_action(state_tuple, epsilon=0.0) # Greedy
                        
                    next_state_tuple, reward, done, info = env.step(action)
                    state_tuple = next_state_tuple
                    
                    total_wait += info["waiting_count"]
                    em_wait += env.state[0] # Count current emergency queue size
                    if info["utilization"] > 0:
                        busy_steps += 1
                    steps += 1
                    
                results[policy]["avg_wait"].append(total_wait / steps)
                results[policy]["emergency_wait"].append(em_wait / steps)
                results[policy]["utilization"].append((busy_steps / steps) * 100.0)
                
        # Calculate Averages
        summary = {}
        for p in policies:
            summary[p] = {
                "avg_wait": float(np.mean(results[p]["avg_wait"])),
                "emergency_wait": float(np.mean(results[p]["emergency_wait"])),
                "utilization": float(np.mean(results[p]["utilization"]))
            }
            
        return summary

if __name__ == "__main__":
    agent = QLearningAgent()
    print("Training agent...")
    hist = agent.train(episodes=100)
    print("Training finished. Final reward:", hist[-1]["reward"])
    
    print("\nEvaluating policies...")
    comparison = agent.evaluate_policies(num_episodes=30)
    for policy, metrics in comparison.items():
        print(f"\nPolicy: {policy}")
        print(f"  Avg Queue Wait Time: {metrics['avg_wait']:.2f} patients/step")
        print(f"  Avg Emergency Queue: {metrics['emergency_wait']:.2f} patients/step")
        print(f"  Scanner Room Utilization: {metrics['utilization']:.1f}%")
