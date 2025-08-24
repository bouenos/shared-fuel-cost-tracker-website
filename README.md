# 🚗💸 Fuel Splitter
*A tiny mobile-first website to stop fighting with my brother about gas money*  

[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

---

## 📖 What is this?  
Fuel Splitter is a **mobile-friendly web app** designed to help two siblings (👨 Amit & 👨 John) fairly split the cost of fuel for the car they share.  

Instead of guessing who owes who (and ending up with endless debates 🙃), the website keeps track of mileage, splits the cost of fuel based on distance driven, and makes sure nobody gets cheated.  

---

## ✨ Features  
- 🔑 **One-time login with a personal code** (no one else can sneak in).  
- ⛽ **Fuel cost calculation**: see exactly how much each of us should pay at the next fueling.  
- 📝 **Mileage input button**: enter the car’s current km reading when you switch drivers.  
- ↩️ **Undo button**: because mistakes happen.  
- 🗑 **Reset button**: finalizes the calculation and even sends a WhatsApp message telling who owes what.  
- 📜 **History log**: see who drove when, and who reset.  
- ⚙️ **Configurable constants**: fuel price & starting mileage.  

---

## 🚀 How does it work?  
1. **Start driving** 🚗  
   - The car has a starting mileage (e.g. `1000 km`).  

2. **Switch drivers** 🔄  
   - When Amit gets out and John gets in, John types the current mileage into the app.  
   - The difference gets added to Amit’s total distance.  

3. **Keep repeating** 📈  
   - Every switch updates the mileage and keeps track of who drove how much.  

4. **Fuel up** ⛽  
   - Whoever fills the tank hits the **Reset button**.  
   - The app calculates how much each person owes using:  
     ```
     Total KM driven by user × Fuel Price
     ```  
   - Sends a WhatsApp message so nobody can argue later.  

---

## 📱 Example Flow  
- Car mileage starts at **1000 km**.  
- Amit drives all week → now mileage = **1180 km**.  
- John gets in, enters **1180** → Amit’s total = **180 km**.  
- John drives the weekend → mileage = **1227 km**.  
- Amit gets in, enters **1227** → John’s total = **47 km**.  
- Amit fuels up, hits **Reset** → John owes Amit `47 × Fuel Price`.  

Cycle continues happily ever after 🎉.  

---

## 🧑‍🏫 How to Use  
1. Clone the repo:  
   ```bash
   git clone https://github.com/bouenos/shared-fuel-cost-tracker-website.git
   cd shared-fuel-cost-tracker-website
   ```
2. Install dependencies:  
   ```bash
   npm install
   ```
3. Run the development server:  
   ```bash
   npm run dev
   ```
4. Open the app in your mobile browser.  
5. Sign in with your personal code (e.g. `1337` for Amit or `1234` for John).  
6. Start entering mileage whenever you swap drivers 🚗💨.  
7. Hit reset after fueling up and let the app calculate who owes what 💸.  

---

## 🙌 Why?  
Because math + family = **arguments**.  
Now, math + website = **peace ✌️**.  

---

## 🔮 Future ideas  
- 📊 Add cool charts for who drives more  
- 💬 Automatic WhatsApp API instead of manual copy-paste   

## 😐 Note
This code was made by v0.app.
Sorry in advance for the hardcoded names and ugly code ;)
