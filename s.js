const SUPABASE_URL = "https://nhnyvztyvovgxbbwmlxx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obnl2enR5dm92Z3hiYndtbHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjU0NDcsImV4cCI6MjEwNjgwMTQ0N30.FlfiRdNzID31aSwGM1gPf2KVliE1fScVGz-Iwopr_0A";

const SYSTEM_DISPATCH_PHONE = "+37044337200";

let currentTag = null;
let chatInterval = null;

async function loadData() {
  const urlParams = new URLSearchParams(window.location.search);
  const tagId = urlParams.get('id') || 'SOS-001';
  document.getElementById('tagIdDisplay').innerText = '#' + tagId;

  const regLink = document.getElementById('registerLink');
  if (regLink) regLink.href = `register.html?id=${encodeURIComponent(tagId)}`;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tags?id=eq.${encodeURIComponent(tagId)}&select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const data = await res.json();
    document.getElementById('loader').classList.add('hidden');

    if (!data || data.length === 0 || !data[0].emergency_phone) {
      document.getElementById('errorView').classList.remove('hidden');
      return;
    }

    currentTag = data[0];
    document.getElementById('mainCard').classList.remove('hidden');

    document.getElementById('tagName').innerText = currentTag.name || 'Pamestas daiktas';
    document.getElementById('tagDetails').innerText = currentTag.details || '';

    if (currentTag.type === 'pet') {
      document.getElementById('tagBadge').innerText = 'Pamestas augintinis';
    } else if (currentTag.type === 'sos') {
      document.getElementById('tagBadge').innerText = 'SOS / Medicininė apsauga';
    } else {
      document.getElementById('tagBadge').innerText = 'Asmeninis daiktas';
    }

    if (currentTag.is_lost) {
      document.getElementById('lostBanner').classList.remove('hidden');
    }

    if (currentTag.reward) {
      document.getElementById('rewardAmount').innerText = currentTag.reward;
      document.getElementById('rewardBox').classList.remove('hidden');
    }

    loadMessages();
    if (!chatInterval) {
      chatInterval = setInterval(loadMessages, 4000);
    }

  } catch (err) {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('errorView').classList.remove('hidden');
  }
}

function triggerCall() {
  const pin = currentTag && currentTag.pin_code ? currentTag.pin_code : '1024';
  window.location.href = `tel:${SYSTEM_DISPATCH_PHONE},,${pin}#`;
}

function sendLocation() {
  if (!confirm("Ar sutinkate nusiųsti radimo vietą savininkui?")) return;

  if (!navigator.geolocation) {
    alert("Geolokacija nepalaikoma naršyklėje.");
    return;
  }

  const btn = document.getElementById('gpsBtn');
  const oldText = btn.innerHTML;
  btn.innerText = "Nustatoma vieta...";

  navigator.geolocation.getCurrentPosition(async (pos) => {
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
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        })
      });
      document.getElementById('gpsSuccessBox').classList.remove('hidden');
    } catch (e) {
      console.error(e);
    } finally {
      btn.innerHTML = oldText;
    }
  }, () => {
    btn.innerHTML = oldText;
    alert("Nepavyko gauti koordinačių.");
  }, { enableHighAccuracy: true, timeout: 10000 });
}

async function loadMessages() {
  if (!currentTag) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/messages?tag_id=eq.${encodeURIComponent(currentTag.id)}&order=created_at.asc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const msgs = await res.json();
    const chatBox = document.getElementById('chatBox');

    if (!msgs || msgs.length === 0) {
      chatBox.innerHTML = '<p class="text-slate-400 text-center text-[11px] py-2">Žinučių nėra. Parašykite radimo detales savininkui.</p>';
      return;
    }

    chatBox.innerHTML = msgs.map(m => {
      const isFinder = m.sender_role === 'finder';
      return `
        <div class="flex flex-col ${isFinder ? 'items-end' : 'items-start'}">
          <div class="max-w-[85%] rounded-xl px-3 py-2 ${isFinder ? 'bg-emerald-800 text-white' : 'bg-white border border-slate-200 text-slate-800 shadow-2xs'}">
            <p>${m.message_text}</p>
          </div>
          <span class="text-[9px] text-slate-400 mt-0.5">${isFinder ? 'Jūs (Radėjas)' : 'Savininkas'}</span>
        </div>
      `;
    }).join('');

    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (e) {
    console.error(e);
  }
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !currentTag) return;

  const btn = document.getElementById('sendMsgBtn');
  btn.disabled = true;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tag_id: currentTag.id,
        sender_role: 'finder',
        message_text: text
      })
    });

    if (res.ok) {
      input.value = '';
      loadMessages();
    }
  } catch (e) {
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

loadData();
