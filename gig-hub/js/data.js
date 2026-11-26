/* Gig Hub — Core Category Metadata & Post Idea Suggestions */
window.GH_DATA = {
  user: null,
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
  gigs: []
};
