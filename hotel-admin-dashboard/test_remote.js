const https = require('https');

const data = JSON.stringify({
  subscriber_id: "1350772126",
  message: "selamlar",
  custom_fields: {
    "14228831": "selamlar",
    "14147239": "Bilinmiyor",
    "14204158": "Misafir"
  }
});

const options = {
  hostname: 'hotel-admin-dashboard-seven.vercel.app',
  path: '/api/webhook/manychat?channel=instagram',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  let output = '';
  res.on('data', d => output += d);
  res.on('end', () => console.log('Response:', output));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
