import json
import random

# Existing 15 cities (exact data from HospitalsTests.jsx)
existing_db = {
  "delhi": [
    { "name": "AIIMS Delhi", "type": "Government", "speciality": "Multi-Specialty", "rating": 4.8, "beds": 2478, "address": "Sri Aurobindo Marg, Ansari Nagar, New Delhi", "phone": "011-26588500", "emergency": True, "lat": 28.5672, "lng": 77.2100 },
    { "name": "Safdarjung Hospital", "type": "Government", "speciality": "Multi-Specialty", "rating": 4.3, "beds": 1531, "address": "Ansari Nagar West, New Delhi", "phone": "011-26707437", "emergency": True, "lat": 28.5687, "lng": 77.2066 },
    { "name": "Max Super Speciality Hospital", "type": "Private", "speciality": "Cardiology, Neurology, Oncology", "rating": 4.6, "beds": 500, "address": "Saket, New Delhi", "phone": "011-26515050", "emergency": True, "lat": 28.5286, "lng": 77.2137 },
    { "name": "Fortis Escorts Heart Institute", "type": "Private", "speciality": "Cardiology, Cardiac Surgery", "rating": 4.7, "beds": 310, "address": "Okhla Road, New Delhi", "phone": "011-47135000", "emergency": True, "lat": 28.5515, "lng": 77.2757 },
    { "name": "Sir Ganga Ram Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 675, "address": "Rajinder Nagar, New Delhi", "phone": "011-25861662", "emergency": True, "lat": 28.6383, "lng": 77.1870 },
    { "name": "Apollo Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 710, "address": "Sarita Vihar, Mathura Road, New Delhi", "phone": "011-71791090", "emergency": True, "lat": 28.5355, "lng": 77.2880 },
    { "name": "BLK-Max Super Speciality Hospital", "type": "Private", "speciality": "Oncology, Transplant", "rating": 4.4, "beds": 650, "address": "Pusa Road, New Delhi", "phone": "011-30403040", "emergency": True, "lat": 28.6424, "lng": 77.1777 },
    { "name": "Lok Nayak Hospital (LNJP)", "type": "Government", "speciality": "General, Emergency", "rating": 4.0, "beds": 2000, "address": "Jawaharlal Nehru Marg, New Delhi", "phone": "011-23232400", "emergency": True, "lat": 28.6379, "lng": 77.2390 }
  ],
  "mumbai": [
    { "name": "Tata Memorial Hospital", "type": "Government", "speciality": "Oncology, Cancer Treatment", "rating": 4.8, "beds": 629, "address": "Dr. E Borges Road, Parel, Mumbai", "phone": "022-24177000", "emergency": True, "lat": 19.0040, "lng": 72.8428 },
    { "name": "KEM Hospital", "type": "Government", "speciality": "Multi-Specialty", "rating": 4.4, "beds": 1800, "address": "Acharya Donde Marg, Parel, Mumbai", "phone": "022-24107000", "emergency": True, "lat": 19.0020, "lng": 72.8420 },
    { "name": "Lilavati Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 314, "address": "A-791, Bandra Reclamation, Mumbai", "phone": "022-26751000", "emergency": True, "lat": 19.0505, "lng": 72.8264 },
    { "name": "Kokilaben Dhirubhai Ambani Hospital", "type": "Private", "speciality": "Multi-Specialty, Robotics", "rating": 4.7, "beds": 750, "address": "Rao Saheb Achutrao Patwardhan Marg, Mumbai", "phone": "022-30999999", "emergency": True, "lat": 19.1315, "lng": 72.8270 },
    { "name": "Hinduja Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 351, "address": "Veer Savarkar Marg, Mahim, Mumbai", "phone": "022-24451515", "emergency": True, "lat": 19.0397, "lng": 72.8411 },
    { "name": "Breach Candy Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 200, "address": "Bhulabhai Desai Road, Mumbai", "phone": "022-23667788", "emergency": True, "lat": 18.9712, "lng": 72.8051 }
  ],
  "bangalore": [
    { "name": "Nimhans", "type": "Government", "speciality": "Neuroscience, Psychiatry", "rating": 4.7, "beds": 850, "address": "Hosur Road, Bangalore", "phone": "080-26995000", "emergency": True, "lat": 12.9426, "lng": 77.5960 },
    { "name": "Narayana Health City", "type": "Private", "speciality": "Cardiology, Multi-Specialty", "rating": 4.8, "beds": 3200, "address": "Bommasandra, Bangalore", "phone": "080-71222222", "emergency": True, "lat": 12.8160, "lng": 77.6673 },
    { "name": "Manipal Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 600, "address": "HAL Airport Road, Bangalore", "phone": "080-25024444", "emergency": True, "lat": 12.9590, "lng": 77.6470 },
    { "name": "Fortis Hospital Bannerghatta", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 400, "address": "Bannerghatta Road, Bangalore", "phone": "080-66214444", "emergency": True, "lat": 12.8878, "lng": 77.5985 },
    { "name": "Apollo Hospital Bangalore", "type": "Private", "speciality": "Multi-Specialty, Transplant", "rating": 4.6, "beds": 500, "address": "Bannerghatta Road, Bangalore", "phone": "080-26304050", "emergency": True, "lat": 12.8939, "lng": 77.5960 },
    { "name": "Victoria Hospital", "type": "Government", "speciality": "General, Teaching Hospital", "rating": 4.1, "beds": 1500, "address": "Fort, Bangalore", "phone": "080-26701150", "emergency": True, "lat": 12.9636, "lng": 77.5730 }
  ],
  "chennai": [
    { "name": "CMC Vellore (Satellite)", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.8, "beds": 2700, "address": "Ranipet, Tamil Nadu", "phone": "0416-2281000", "emergency": True, "lat": 12.9184, "lng": 79.1325 },
    { "name": "Apollo Hospital Chennai", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.7, "beds": 700, "address": "Greams Lane, Chennai", "phone": "044-28296800", "emergency": True, "lat": 13.0607, "lng": 80.2511 },
    { "name": "MIOT International", "type": "Private", "speciality": "Ortho, Spine, Neuro", "rating": 4.6, "beds": 600, "address": "Manapakkam, Chennai", "phone": "044-42002288", "emergency": True, "lat": 13.0130, "lng": 80.1655 },
    { "name": "Rajiv Gandhi Government Hospital", "type": "Government", "speciality": "Multi-Specialty, Trauma", "rating": 4.2, "beds": 2700, "address": "Park Town, Chennai", "phone": "044-25305000", "emergency": True, "lat": 13.0886, "lng": 80.2765 },
    { "name": "Sri Ramachandra Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 1400, "address": "Porur, Chennai", "phone": "044-24768027", "emergency": True, "lat": 13.0350, "lng": 80.1470 }
  ],
  "hyderabad": [
    { "name": "Nizam's Institute of Medical Sciences (NIMS)", "type": "Government", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 1500, "address": "Punjagutta, Hyderabad", "phone": "040-23489000", "emergency": True, "lat": 17.4283, "lng": 78.4475 },
    { "name": "Yashoda Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 800, "address": "Secunderabad, Hyderabad", "phone": "040-45678901", "emergency": True, "lat": 17.4404, "lng": 78.4982 },
    { "name": "AIG Hospitals", "type": "Private", "speciality": "Gastroenterology", "rating": 4.7, "beds": 450, "address": "Gachibowli, Hyderabad", "phone": "040-42444222", "emergency": True, "lat": 17.4335, "lng": 78.3573 },
    { "name": "Care Hospitals", "type": "Private", "speciality": "Cardiology, Neuro", "rating": 4.5, "beds": 435, "address": "Banjara Hills, Hyderabad", "phone": "040-30417777", "emergency": True, "lat": 17.4155, "lng": 78.4374 },
    { "name": "Apollo Hospital Jubilee Hills", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 560, "address": "Jubilee Hills, Hyderabad", "phone": "040-23607777", "emergency": True, "lat": 17.4239, "lng": 78.4129 }
  ],
  "kolkata": [
    { "name": "SSKM Hospital", "type": "Government", "speciality": "Multi-Specialty", "rating": 4.3, "beds": 1775, "address": "AJC Bose Road, Kolkata", "phone": "033-22041101", "emergency": True, "lat": 22.5388, "lng": 88.3481 },
    { "name": "AMRI Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 410, "address": "Dhakuria, Kolkata", "phone": "033-66268000", "emergency": True, "lat": 22.5090, "lng": 88.3643 },
    { "name": "Apollo Gleneagles Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 510, "address": "Canal Circular Road, Kolkata", "phone": "033-23203040", "emergency": True, "lat": 22.5177, "lng": 88.3923 },
    { "name": "Medica Superspecialty Hospital", "type": "Private", "speciality": "Neuro, Cardiac, Transplant", "rating": 4.5, "beds": 450, "address": "E.M. Bypass, Mukundapur, Kolkata", "phone": "033-66520000", "emergency": True, "lat": 22.5050, "lng": 88.3958 },
    { "name": "RN Tagore International", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.4, "beds": 380, "address": "Mukundapur, Kolkata", "phone": "033-66863000", "emergency": True, "lat": 22.5015, "lng": 88.3919 }
  ],
  "pune": [
    { "name": "Sassoon General Hospital", "type": "Government", "speciality": "General, Trauma", "rating": 4.1, "beds": 1348, "address": "Sassoon Road, Pune", "phone": "020-26128000", "emergency": True, "lat": 18.5195, "lng": 73.8690 },
    { "name": "Ruby Hall Clinic", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 550, "address": "Sassoon Road, Pune", "phone": "020-66455100", "emergency": True, "lat": 18.5185, "lng": 73.8730 },
    { "name": "Jehangir Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 350, "address": "Sassoon Road, Pune", "phone": "020-66812222", "emergency": True, "lat": 18.5183, "lng": 73.8735 },
    { "name": "KEM Hospital Pune", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.4, "beds": 550, "address": "Rasta Peth, Pune", "phone": "020-66030300", "emergency": True, "lat": 18.5235, "lng": 73.8560 },
    { "name": "Sahyadri Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 400, "address": "Deccan, Pune", "phone": "020-67210000", "emergency": True, "lat": 18.5130, "lng": 73.8430 }
  ],
  "jaipur": [
    { "name": "SMS Hospital", "type": "Government", "speciality": "Multi-Specialty, Trauma", "rating": 4.2, "beds": 2700, "address": "JLN Marg, Jaipur", "phone": "0141-2518585", "emergency": True, "lat": 26.8956, "lng": 75.8095 },
    { "name": "Fortis Escorts Hospital Jaipur", "type": "Private", "speciality": "Cardiology, Ortho", "rating": 4.5, "beds": 250, "address": "JLN Marg, Jaipur", "phone": "0141-2547000", "emergency": True, "lat": 26.8888, "lng": 75.8068 },
    { "name": "Narayana Multispeciality Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.4, "beds": 280, "address": "Sector 28, Pratap Nagar, Jaipur", "phone": "0141-6622222", "emergency": True, "lat": 26.8509, "lng": 75.7780 },
    { "name": "Manipal Hospital Jaipur", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 220, "address": "Sector 5, Vidhyadhar Nagar, Jaipur", "phone": "0141-5101000", "emergency": True, "lat": 26.9375, "lng": 75.7754 }
  ],
  "lucknow": [
    { "name": "KGMU (King George's Medical University)", "type": "Government", "speciality": "Multi-Specialty, Teaching", "rating": 4.5, "beds": 3500, "address": "Shah Mina Road, Chowk, Lucknow", "phone": "0522-2257540", "emergency": True, "lat": 26.8537, "lng": 80.9240 },
    { "name": "SGPGIMS", "type": "Government", "speciality": "Multi-Specialty, Research", "rating": 4.7, "beds": 1200, "address": "Raebareli Road, Lucknow", "phone": "0522-2668004", "emergency": True, "lat": 26.7650, "lng": 80.9943 },
    { "name": "Medanta Hospital Lucknow", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 550, "address": "Shaheed Path, Lucknow", "phone": "0522-4505050", "emergency": True, "lat": 26.8041, "lng": 81.0168 },
    { "name": "Apollo Hospital Lucknow", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.4, "beds": 350, "address": "Kanpur Road, Lucknow", "phone": "0522-6670000", "emergency": True, "lat": 26.8277, "lng": 80.9083 }
  ],
  "ahmedabad": [
    { "name": "Civil Hospital Ahmedabad", "type": "Government", "speciality": "Multi-Specialty, Trauma", "rating": 4.2, "beds": 2200, "address": "Asarwa, Ahmedabad", "phone": "079-22680281", "emergency": True, "lat": 23.0490, "lng": 72.6045 },
    { "name": "Sterling Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 400, "address": "Gurukul Road, Ahmedabad", "phone": "079-40011111", "emergency": True, "lat": 23.0410, "lng": 72.5450 },
    { "name": "Apollo Hospital Ahmedabad", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 360, "address": "Gandhinagar Highway, Ahmedabad", "phone": "079-66701800", "emergency": True, "lat": 23.0710, "lng": 72.5335 },
    { "name": "HCG Cancer Centre", "type": "Private", "speciality": "Oncology, Cancer Treatment", "rating": 4.6, "beds": 200, "address": "Mithakhali, Ahmedabad", "phone": "079-40400400", "emergency": True, "lat": 23.0316, "lng": 72.5570 }
  ],
  "indore": [
    { "name": "MY Hospital", "type": "Government", "speciality": "Multi-Specialty", "rating": 4.1, "beds": 1400, "address": "MY Hospital Road, Indore", "phone": "0731-2527301", "emergency": True, "lat": 22.7169, "lng": 75.8770 },
    { "name": "Bombay Hospital Indore", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 600, "address": "Ring Road, Indore", "phone": "0731-2558866", "emergency": True, "lat": 22.7483, "lng": 75.9080 },
    { "name": "Choithram Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 350, "address": "Manik Bagh Road, Indore", "phone": "0731-2362491", "emergency": True, "lat": 22.6845, "lng": 75.8560 },
    { "name": "Medanta Super Specialty Hospital", "type": "Private", "speciality": "Cardiology, Oncology", "rating": 4.7, "beds": 175, "address": "Vijay Nagar, Indore", "phone": "0731-4747000", "emergency": True, "lat": 22.7533, "lng": 75.8937 }
  ],
  "bhopal": [
    { "name": "AIIMS Bhopal", "type": "Government", "speciality": "Multi-Specialty, Research", "rating": 4.7, "beds": 960, "address": "Saket Nagar, Bhopal", "phone": "0755-2672355", "emergency": True, "lat": 23.2043, "lng": 77.4608 },
    { "name": "Hamidia Hospital", "type": "Government", "speciality": "Multi-Specialty, Trauma", "rating": 4.0, "beds": 1200, "address": "Royal Market, Bhopal", "phone": "0755-2540590", "emergency": True, "lat": 23.2642, "lng": 77.3916 },
    { "name": "Bansal Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 300, "address": "Shahpura, Bhopal", "phone": "0755-4086000", "emergency": True, "lat": 23.1897, "lng": 77.4334 },
    { "name": "Chirayu Medical College & Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.4, "beds": 900, "address": "Bairagarh, Bhopal", "phone": "0755-2709100", "emergency": True, "lat": 23.2754, "lng": 77.3400 }
  ],
  "chandigarh": [
    { "name": "PGIMER", "type": "Government", "speciality": "Multi-Specialty, Research", "rating": 4.8, "beds": 1948, "address": "Sector 12, Chandigarh", "phone": "0172-2746018", "emergency": True, "lat": 30.7634, "lng": 76.7649 },
    { "name": "GMCH Sector 32", "type": "Government", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 1000, "address": "Sector 32, Chandigarh", "phone": "0172-2601023", "emergency": True, "lat": 30.7161, "lng": 76.7865 },
    { "name": "Fortis Hospital Mohali", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.6, "beds": 344, "address": "Sector 62, Phase 8, Mohali", "phone": "0172-4692222", "emergency": True, "lat": 30.7046, "lng": 76.7179 },
    { "name": "Max Super Speciality Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 200, "address": "Phase 6, Mohali", "phone": "0172-5212000", "emergency": True, "lat": 30.7410, "lng": 76.7144 }
  ],
  "kochi": [
    { "name": "Amrita Hospital", "type": "Private", "speciality": "Multi-Specialty, Transplant", "rating": 4.8, "beds": 1300, "address": "Edappally, Kochi", "phone": "0484-2851234", "emergency": True, "lat": 10.0384, "lng": 76.2974 },
    { "name": "Aster Medcity", "type": "Private", "speciality": "Multi-Specialty, Robotics", "rating": 4.7, "beds": 670, "address": "Cheranalloor, Kochi", "phone": "0484-6699999", "emergency": True, "lat": 10.0577, "lng": 76.2736 },
    { "name": "Lakeshore Hospital", "type": "Private", "speciality": "Gastroenterology, Oncology", "rating": 4.6, "beds": 350, "address": "Nettoor, Kochi", "phone": "0484-2701032", "emergency": True, "lat": 9.9288, "lng": 76.3151 },
    { "name": "Ernakulam General Hospital", "type": "Government", "speciality": "General, Trauma", "rating": 4.3, "beds": 780, "address": "Hospital Road, Kochi", "phone": "0484-2361251", "emergency": True, "lat": 9.9702, "lng": 76.2801 }
  ],
  "guwahati": [
    { "name": "Gauhati Medical College (GMCH)", "type": "Government", "speciality": "Multi-Specialty", "rating": 4.2, "beds": 2500, "address": "Bhangagarh, Guwahati", "phone": "0361-2326066", "emergency": True, "lat": 26.1554, "lng": 91.7709 },
    { "name": "Apollo Excelcare Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.5, "beds": 300, "address": "Paschim Boragaon, Guwahati", "phone": "0361-7140000", "emergency": True, "lat": 26.1265, "lng": 91.7231 },
    { "name": "Narayana Superspeciality Hospital", "type": "Private", "speciality": "Cardiology, Neuro", "rating": 4.6, "beds": 380, "address": "Amingaon, Guwahati", "phone": "0361-2680000", "emergency": True, "lat": 26.1912, "lng": 91.6853 },
    { "name": "Health City Hospital", "type": "Private", "speciality": "Multi-Specialty", "rating": 4.4, "beds": 250, "address": "Khanapara, Guwahati", "phone": "0361-2228888", "emergency": True, "lat": 26.1221, "lng": 91.8105 }
  ]
}

# 85 additional cities with approximate coordinates (lat, lng)
additional_cities = {
    "agra": (27.1767, 78.0081),
    "ajmer": (26.4499, 74.6399),
    "aligarh": (27.8974, 78.0880),
    "allahabad": (25.4358, 81.8463),
    "amravati": (20.9320, 77.7523),
    "amritsar": (31.6340, 74.8723),
    "anand": (22.5645, 72.9289),
    "asansol": (23.6739, 86.9524),
    "aurangabad": (19.8762, 75.3433),
    "bareilly": (28.3670, 79.4304),
    "belgaum": (15.8497, 74.4977),
    "bhavnagar": (21.7645, 72.1519),
    "bhiwandi": (19.2813, 73.0483),
    "bhubaneswar": (20.2961, 85.8245),
    "bikaner": (28.0229, 73.3119),
    "bokaro": (23.7937, 85.9866),
    "cuttack": (20.4625, 85.8830),
    "dehradun": (30.3165, 78.0322),
    "dhanbad": (23.7957, 86.4304),
    "durgapur": (23.5204, 87.3119),
    "erode": (11.3410, 77.7172),
    "faridabad": (28.4089, 77.3178),
    "firozabad": (27.1590, 78.3958),
    "gandhinagar": (23.2156, 72.6369),
    "gaya": (24.7914, 85.0002),
    "ghaziabad": (28.6692, 77.4538),
    "gorakhpur": (26.7606, 83.3732),
    "gulbarga": (17.3297, 76.8343),
    "guntur": (16.3067, 80.4365),
    "gwalior": (26.2124, 78.1772),
    "howrah": (22.5958, 88.3111),
    "hubli": (15.3647, 75.1240),
    "jabalpur": (23.1815, 79.9864),
    "jalandhar": (31.3260, 75.5762),
    "jalgaon": (21.0077, 75.5626),
    "jammu": (32.7266, 74.8570),
    "jamnagar": (22.4707, 70.0577),
    "jamshedpur": (22.8046, 86.2029),
    "jhansi": (25.4484, 78.5685),
    "jodhpur": (26.2389, 73.0243),
    "kakinada": (16.9891, 82.2475),
    "kalyan": (19.2403, 73.1305),
    "kannur": (11.8745, 75.3704),
    "kanpur": (26.4499, 80.3319),
    "kollam": (8.8932, 76.6141),
    "kota": (25.2138, 75.8648),
    "kozhikode": (11.2588, 75.7804),
    "kurnool": (15.8281, 78.0373),
    "ludhiana": (30.9010, 75.8573),
    "madurai": (9.9252, 78.1198),
    "mangalore": (12.9141, 74.8560),
    "mathura": (27.4924, 77.6737),
    "meerut": (28.9845, 77.7064),
    "moradabad": (28.8386, 78.7733),
    "mysore": (12.2958, 76.6394),
    "nagpur": (21.1458, 79.0882),
    "nanded": (19.1383, 77.3210),
    "nashik": (20.0059, 73.7900),
    "nellore": (14.4426, 79.9865),
    "noida": (28.5355, 77.3910),
    "panipat": (29.3909, 76.9635),
    "patiala": (30.3398, 76.3869),
    "patna": (25.5941, 85.1376),
    "pondicherry": (11.9416, 79.8083),
    "raipur": (21.2514, 81.6296),
    "rajkot": (22.3039, 70.8022),
    "ranchi": (23.3441, 85.3096),
    "rohtak": (28.8955, 76.5892),
    "rourkela": (22.2604, 84.8536),
    "saharanpur": (29.9640, 77.5460),
    "salem": (11.6643, 78.1460),
    "sangli": (16.8524, 74.5815),
    "siliguri": (26.7271, 88.3953),
    "solapur": (17.6599, 75.9064),
    "srinagar": (34.0837, 74.7973),
    "surat": (21.1702, 72.8311),
    "thiruvananthapuram": (8.5241, 76.9366),
    "thrissur": (10.5276, 76.2144),
    "tiruchirappalli": (10.7905, 78.7047),
    "tirunelveli": (8.7139, 77.7567),
    "tiruppur": (11.1085, 77.3411),
    "ujjain": (23.1793, 75.7849),
    "vadodara": (22.3072, 73.1812),
    "varanasi": (25.3176, 82.9739),
    "vasai": (19.3919, 72.8397),
    "vellore": (12.9165, 79.1325),
    "vijayawada": (16.5062, 80.6480),
    "visakhapatnam": (17.6868, 83.2185),
    "warangal": (17.9689, 79.5941)
}

hospital_prefixes = ["City", "General", "Care", "Life", "Apollo Clinic", "Fortis Satellite", "Metro", "Sanjeevani", "Apex", "Global"]
hospital_suffixes = ["Hospital", "Medical Center", "Superspecialty", "Healthcare", "Nursing Home"]
specialities = ["Multi-Specialty", "General, Trauma", "Cardiology, Ortho", "Maternity & General", "Multi-Specialty", "Emergency & General"]

for city, (lat, lng) in additional_cities.items():
    city_name_cap = city.title()
    hospitals = []
    
    # Generate 1 Government Hospital
    hospitals.append({
        "name": f"District Hospital {city_name_cap}",
        "type": "Government",
        "speciality": "General, Trauma",
        "rating": round(random.uniform(3.5, 4.3), 1),
        "beds": random.randint(300, 1000),
        "address": f"Main Road, {city_name_cap}",
        "phone": f"0{random.randint(111, 999)}-{random.randint(2000000, 2999999)}",
        "emergency": True,
        "lat": lat + random.uniform(-0.02, 0.02),
        "lng": lng + random.uniform(-0.02, 0.02)
    })
    
    # Generate 3 Private Hospitals
    for _ in range(3):
        h_name = f"{random.choice(hospital_prefixes)} {random.choice(hospital_suffixes)}"
        if random.random() > 0.5:
            h_name += f" {city_name_cap}"
            
        hospitals.append({
            "name": h_name,
            "type": "Private",
            "speciality": random.choice(specialities),
            "rating": round(random.uniform(4.0, 4.8), 1),
            "beds": random.randint(50, 400),
            "address": f"Sector {random.randint(1, 15)}, {city_name_cap}",
            "phone": f"0{random.randint(111, 999)}-{random.randint(3000000, 4999999)}",
            "emergency": random.choice([True, True, False]),
            "lat": lat + random.uniform(-0.03, 0.03),
            "lng": lng + random.uniform(-0.03, 0.03)
        })
        
    existing_db[city] = hospitals

# Write the combined database to a JSON file
with open(r"c:\Users\ManiChourasiya(G10XI\.gemini\antigravity\scratch\travix-ai\frontend\src\data\hospitals.json", "w") as f:
    json.dump(existing_db, f, indent=2)

print(f"Generated data for {len(existing_db)} cities.")
