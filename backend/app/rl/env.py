import random
import numpy as np

class HospitalQueueEnv:
    def __init__(self, max_queue_len: int = 5):
        self.max_queue_len = max_queue_len
        # State: (emergency_queue, urgent_queue, routine_queue, scanner_busy)
        self.state = [0, 0, 0, 0]
        self.steps = 0
        self.max_steps = 50
        
    def reset(self):
        self.state = [
            random.randint(0, 2), # Initial Emergency
            random.randint(0, 3), # Initial Urgent
            random.randint(0, 4), # Initial Routine
            0                     # Scanner free
        ]
        self.steps = 0
        return self._get_state_key()

    def _get_state_key(self) -> tuple:
        # Cap queues for state representation to keep Q-table bounded
        return (
            min(self.state[0], self.max_queue_len),
            min(self.state[1], self.max_queue_len),
            min(self.state[2], self.max_queue_len),
            self.state[3]
        )

    def step(self, action: int) -> tuple:
        """
        Actions:
        0: Idle
        1: Schedule Emergency patient next
        2: Schedule Urgent patient next
        3: Schedule Routine patient next
        """
        self.steps += 1
        
        # Unpack state
        eq, uq, rq, busy = self.state
        
        reward = 0.0
        processed = False
        
        # Resolve scanner status: if busy, it has a 70% chance of clearing
        if busy == 1:
            if random.random() < 0.7:
                self.state[3] = 0
                busy = 0
                
        # Perform action if scanner is free
        if busy == 0:
            if action == 1 and eq > 0:
                self.state[0] -= 1
                self.state[3] = 1 # Scanner becomes busy
                reward += 20.0     # High reward for processing emergency
                processed = True
            elif action == 2 and uq > 0:
                self.state[1] -= 1
                self.state[3] = 1
                reward += 10.0
                processed = True
            elif action == 3 and rq > 0:
                self.state[2] -= 1
                self.state[3] = 1
                reward += 5.0
                processed = True
            elif action != 0:
                # Penalty for trying to process an empty queue
                reward -= 10.0
        else:
            # Penalty for trying to schedule when scanner is busy
            if action != 0:
                reward -= 5.0

        # Simulate new patient arrivals
        # Emergency: 10% chance
        if random.random() < 0.15:
            self.state[0] = min(self.state[0] + 1, self.max_queue_len + 2)
        # Urgent: 25% chance
        if random.random() < 0.30:
            self.state[1] = min(self.state[1] + 1, self.max_queue_len + 2)
        # Routine: 40% chance
        if random.random() < 0.45:
            self.state[2] = min(self.state[2] + 1, self.max_queue_len + 2)

        # Apply waiting penalties (Cost function)
        # We penalize based on current queue lengths and priority weights
        eq_wait, uq_wait, rq_wait = self.state[0], self.state[1], self.state[2]
        waiting_penalty = (eq_wait * 15.0) + (uq_wait * 5.0) + (rq_wait * 1.5)
        reward -= waiting_penalty

        done = self.steps >= self.max_steps
        
        # Calculate stats for logging
        total_waiting_patients = eq_wait + uq_wait + rq_wait
        resource_utilization = 100.0 if self.state[3] == 1 else 0.0
        
        info = {
            "queue_lengths": (self.state[0], self.state[1], self.state[2]),
            "waiting_count": total_waiting_patients,
            "utilization": resource_utilization
        }
        
        return self._get_state_key(), reward, done, info
