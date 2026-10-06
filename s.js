const SUPABASE_URL = "https://nhnyvztyvovgxbbwmlxx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obnl2enR5dm92Z3hiYndtbHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjU0NDcsImV4cCI6MjEwNjgwMTQ0N30.FlfiRdNzID31aSwGM1gPf2KVliE1fScVGz-Iwopr_0A";

const TG_BOT_TOKEN = "8716784258:AAESHrfQS77RWGDbZhbnBMmOGlkUYNMJbeU";
const TG_CHAT_ID = "8840219972";

// Jūsų aktyvuotas Twilio numeris anoniminiams skambučiams
const SYSTEM_DISPATCH_PHONE = "+14432413909";

let currentTag = null;

async function loadData() {
  const urlParams = new URLSearchParams(window.location.search);
  const tagId = urlParams.get('id') || 'SOS-001';
  const tagDisplay = document.getElementById('tagIdDisplay');
  if (tagDisplay) tagDisplay.innerText = '#' + tagId;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tags?id=eq.${encodeURIComponent(tagId)}&select=*`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) throw new Error('HTTP klaida: ' + res.status);

    const data = await res.json();
    document.getElementById('loader').classList.add('hidden');

    if (!data || data.length === 0) {
      document.getElementById('errorView').classList.remove('hidden');
      return;
    }

    currentTag = data[0];
    document.getElementById('mainCard').classList.remove('hidden');

    if (currentTag.type === 'pet') {
      document.getElementById('petView').classList.remove('hidden');
      document.getElementById('petName').innerText = currentTag.name || '';
      document.getElementById('petDetails').innerText = (currentTag.details || '') + (currentTag.age ? ' • ' + currentTag.age : '');
      if (currentTag.reward) {
        document.getElementById('petReward').innerText = currentTag.reward;
      } else {
        document.getElementById('petRewardBadge').classList.add('hidden');
      }
    } else {
      document.getElementById('sosView').classList.remove('hidden');
      document.getElementById('sosName').innerText = currentTag.name || '';
      document.getElementById('sosAge').innerText = currentTag.age || '';
      document.getElementById('sosDetails').innerText = currentTag.details || 'Nenurodyta';
      document.getElementById('sosCritical').innerText = currentTag.critical_info || 'Nenurodyta';
    }
  } catch (err) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('errorView').classList.remove('hidden');
    document.getElementById('debugError').innerText = err.message;
  }
}

function triggerCall() {
  const pin = currentTag && currentTag.pin_code ? currentTag.pin_code : '1024';
  
  // Automatinis rinkimas per Twilio šliuzą su 2 sek. pauze ir PIN kodu
  const dialString = `${SYSTEM_DISPATCH_PHONE},,${pin}#`;
  
  window.location.href = `tel:${dialString}`;
}

function sendLocation() {
  const confirmText = "Ar sutinkate nusiųsti savo buvimo vietą šeimai / šeimininkui, kad jie galėtų atvykti?";
  if (!confirm(confirmText)) {
    return;
  }

  if (!navigator.geolocation) {
    alert("Geolokacija nepalaikoma jūsų naršyklėje.");
    return;
  }

  const activeBtn = currentTag.type === 'pet' ? document.getElementById('petGpsBtn') : document.getElementById('gpsBtn');
  const originalText = activeBtn.innerHTML;
  activeBtn.innerText = "Nustatoma vieta...";

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const mapsLink = `https://maps.google.com/?q=${lat},${lon}`;

    // 1. Įrašymas į Supabase scan_logs
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/scan_logs`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tag_id: currentTag.id,
          latitude: lat,
          longitude: lon
        })
      });
    } catch (e) {
      console.error("Klaida įrašant į Supabase:", e);
    }

    // 2. Automatinis Telegram pranešimas
    try {
      const typeLabel = currentTag.type === 'pet' ? '🐾 Rastas gyvūnas / daiktas' : '🚨 SKUBI PAGALBA (SOS)';
      const pinInfo = currentTag.pin_code ? `\nSaugus PIN: ${currentTag.pin_code}` : '';
      const text = `${typeLabel}\n\nPakabukas: #${currentTag.id}${pinInfo}\nVardas: ${currentTag.name || 'Nenurodyta'}\n\n📍 Vieta žemėlapyje:\n${mapsLink}`;

      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TG_CHAT_ID,
          text: text
        })
      });
    } catch (e) {
      console.error("Klaida siunčiant į Telegram:", e);
    }

    activeBtn.innerHTML = originalText;
    document.getElementById('gpsSuccessBox').classList.remove('hidden');

  }, (err) => {
    activeBtn.innerHTML = originalText;
    alert("Vietos nustatymas atmestas arba neprieinamas.");
  }, { enableHighAccuracy: true, timeout: 10000 });
}

loadData();
