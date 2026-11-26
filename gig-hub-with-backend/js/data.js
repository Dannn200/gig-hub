/* Gig Hub — sample marketplace data (replace with a real backend later) */
window.GH_DATA = {
  user: { name: "Ayush Kumar", first: "Ayush", init: "AK", balance: 1240,
          skills: ["html","css","python","design","video","presentation","poster","coding"] },
  cats: {
    food:     { label: "Food",     icon: "🍱", pill: "orange-pill" },
    skills:   { label: "Skills",   icon: "💡", pill: "purple-pill" },
    events:   { label: "Events",   icon: "🎪", pill: "blue-pill" },
    tasks:    { label: "Task",     icon: "🛵", pill: "orange-pill" },
    academic: { label: "Academic", icon: "📚", pill: "purple-pill" }
  },
  /* Ideas shown on the Post-a-Gig page once a category is chosen */
  ideas: {
    food:     { range: [50, 150],  price: 100, titles: ["Share a Biryani order at the cafeteria","Split a pizza for 4 students","Group order from the South Indian corner"], places: ["Main Cafeteria","Student Food Court"] },
    skills:   { range: [200, 600], price: 350, titles: ["Design a poster for our club event","Edit a 30-second Instagram reel","Build a simple portfolio website"], places: ["Online","Library Lounge"] },
    task:     { range: [50, 150],  price: 80,  titles: ["Parcel pickup from the campus gate","Print and deliver notes to the hostel","Buy stationery from the market"], places: ["Main Gate","Hostel Block B"] },
    event:    { range: [200, 500], price: 300, titles: ["Volunteers needed for the university fest","Photographer for a society event","Promote our event on campus"], places: ["Main Ground","Auditorium"] },
    academic: { range: [150, 400], price: 250, titles: ["Python assignment help session","Last-minute exam revision partner","Explain DBMS concepts before the viva"], places: ["Online","Library Study Room"] }
  },
  gigs: [
    /* Food orders (preserved from original) */
    { id:"f1", cat:"food", title:"Chicken Biryani", desc:"Share a Chicken Biryani order at the Main Cafeteria and split the cost.", price:120, unit:"/person", loc:"Main Cafeteria", when:"Today · 1:00 PM", icon:"🍛", img:"biryani", spots:3, total:8, tags:["biryani","lunch","chicken"], by:"Rahul Sharma", init:"RS", order:1 },
    { id:"f2", cat:"food", title:"Masala Dosa", desc:"Crispy masala dosa with chutney and sambar — pooled order from the South Indian Corner.", price:70, unit:"/person", loc:"South Indian Corner", when:"Today · 5:30 PM", icon:"🥞", img:"dosa", spots:2, total:6, tags:["dosa","south indian","snack"], by:"Priya Mehta", init:"PM", order:2 },
    { id:"f3", cat:"food", title:"North Indian Thali", desc:"Full thali with dal, sabzi, roti, rice and sweet. Pooled order for a better rate.", price:95, unit:"/person", loc:"University Cafeteria", when:"Today · 1:30 PM", icon:"🍱", img:"thali", spots:4, total:8, tags:["thali","lunch","veg"], by:"Ankit Verma", init:"AV", order:3 },
    { id:"f4", cat:"food", title:"Veg Momos", desc:"Steamed veg momos with spicy chutney, shared between friends at the food court.", price:60, unit:"/person", loc:"Student Food Court", when:"Today · 6:00 PM", icon:"🥟", img:"momos", spots:2, total:6, tags:["momos","snack","veg"], by:"Sneha Roy", init:"SR", order:4 },
    { id:"f5", cat:"food", title:"Pizza Order Sharing", desc:"Large pizza split across four students — pick your slices and pay your share.", price:80, unit:"/person", loc:"Main Cafeteria", when:"Tomorrow · 7:00 PM", icon:"🍕", img:"pizza", spots:3, total:4, tags:["pizza","dinner"], by:"Karan Singh", init:"KS", order:5 },

    /* Latest gigs (preserved from original) */
    { id:"g1", cat:"skills", title:"Design a poster for club event", desc:"Need a creative poster for our coding club event.", price:400, loc:"Online", when:"Today", icon:"🎨", tone:"purple", pill:"purple-pill", pillLabel:"Skills", tags:["design","poster","graphic design","coding"], by:"Coding Club", init:"CC", order:10, long:"Our coding club is hosting its annual hackathon and we need a bold, modern A3 poster plus a square version for Instagram. We will share the logo, date, venue and sponsor logos. Editable source files (Canva / Figma / PSD) required." },
    { id:"g2", cat:"tasks", title:"Parcel pickup from campus gate", desc:"Pick up a small parcel and deliver to Hostel Block B.", price:80, loc:"Main Gate", when:"Today", icon:"📦", tone:"orange", pill:"orange-pill", pillLabel:"Task", tags:["parcel","delivery","hostel"], by:"Meera Joshi", init:"MJ", order:11, long:"A small parcel (under 2 kg) is waiting at the main gate security desk. Collect it with the order ID I will share and drop it at Hostel Block B, reception." },
    { id:"g3", cat:"skills", title:"Short video edit for society", desc:"Edit a 30-second Instagram reel for our society.", price:350, loc:"Online", when:"2 days", icon:"🎬", tone:"green", pill:"green-pill", pillLabel:"Skills", tags:["video","editing","reel"], by:"Media Society", init:"MS", order:12, long:"We have raw clips from our last event. We need a snappy 30-second vertical reel with captions, transitions and royalty-free music. Delivery within 2 days." },

    /* Dashboard recommendations (preserved from original) */
    { id:"g4", cat:"academic", title:"Python Assignment Help", desc:"Computer Science · Get guided help with a Python assignment.", price:250, loc:"Library Study Room", when:"Today · 4:00 PM", icon:"💻", tone:"purple", pill:"purple-pill", pillLabel:"Academic", tags:["python","academic","coding"], by:"Rahul Sharma", init:"RS", order:13, long:"A one-hour guided session to work through a Python assignment on lists, functions and file handling. We will go step by step so you actually understand the solution." },
    { id:"g5", cat:"events", title:"University Fest Volunteer", desc:"Help with registrations and crowd management at the university fest.", price:300, loc:"Main Ground", when:"Tomorrow · 10:00 AM", icon:"🎉", tone:"orange", pill:"blue-pill", pillLabel:"Events", tags:["volunteer","fest","event","2 hours"], by:"Student Council", init:"SC", order:14, long:"Volunteers are needed at the registration desk and entry gates for 2 hours. Report to the Main Ground at 10:00 AM. Fest T-shirt and snacks provided." },

    /* A few extra samples so suggestions feel real */
    { id:"g6", cat:"skills", title:"Build a landing page in HTML & CSS", desc:"Simple one-page site for a student startup.", price:500, loc:"Online", when:"3 days", icon:"🖥️", tone:"blue", pill:"blue-pill", pillLabel:"Skills", tags:["html","css","web","coding"], by:"E-Cell", init:"EC", order:15, long:"The E-Cell needs a clean one-page landing site (hero, features, contact form) built in plain HTML and CSS. Content and brand colours will be provided." },
    { id:"g7", cat:"events", title:"Photographer for cultural night", desc:"Capture photos for the annual cultural night.", price:500, loc:"Auditorium", when:"Friday · 6:00 PM", icon:"📸", tone:"rose", pill:"blue-pill", pillLabel:"Events", tags:["photo","event","camera"], by:"Cultural Committee", init:"CM", order:16, long:"Looking for a student photographer to cover performances and backstage moments. Bring your own camera; edited highlights needed within 3 days." },
    { id:"g8", cat:"academic", title:"DSA doubt-clearing session", desc:"One-hour session on arrays, stacks and queues.", price:200, loc:"Online", when:"Tomorrow · 8:00 PM", icon:"🧠", tone:"purple", pill:"purple-pill", pillLabel:"Academic", tags:["dsa","coding","python","academic"], by:"Neha Kapoor", init:"NK", order:17, long:"Struggling with stacks, queues and recursion? Let's go through practice problems together over a one-hour video call." },
    { id:"g9", cat:"skills", title:"Design slides for a pitch competition", desc:"Clean 10-slide deck for an inter-college pitch.", price:450, loc:"Online", when:"2 days", icon:"📊", tone:"green", pill:"green-pill", pillLabel:"Skills", tags:["presentation","design","slides"], by:"Team Innovate", init:"TI", order:18, long:"We have the content ready; we need a polished 10-slide deck with consistent styling, icons and a clear story flow." }
  ]
};
