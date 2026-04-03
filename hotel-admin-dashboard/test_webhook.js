fetch("https://hotel-admin-dashboard-seven.vercel.app/api/webhook/manychat?channel=instagram", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    subscriber_id: "1350772126",
    message: "selamlar",
    custom_fields: {
      "14228831": "selamlar",
      "14147239": "Bilinmiyor",
      "14204158": "Misafir"
    }
  })
}).then(res => res.json()).then(console.log).catch(console.error);
