const cockpit = document.querySelector('#cockpit');
const canvas = document.querySelector('#space');
const context = canvas.getContext('2d');
const terminal = document.querySelector('#terminal-lines');
const craftName = document.querySelector('#craft-name');
const reticleLabel = document.querySelector('#reticle-label');
const commandCount = document.querySelector('#command-count');
let commands = 10;
let phase = 0;
let selectedContact = 0;
let contacts = [];

const craft = {
  surveyor: {
    name: 'NRSV FARSTAR',
    message: 'long-range posture engaged; Home remains fixed',
  },
  interceptor: {
    name: 'NRSV RICOCHET',
    message: 'inertial navigation unlocked; each impact may become center',
  },
  darkroom: {
    name: 'NRSV PARALLAX',
    message: 'optical comparison chamber aligned A/B',
  },
  anatomical: {
    name: 'NRSV PRIAPUS',
    message: 'dual reservoirs coupled to retractable probe',
  },
};

function resize() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.floor(bounds.width * ratio);
  canvas.height = Math.floor(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  seedContacts(bounds.width, bounds.height);
}

function seedContacts(width, height) {
  const random = mulberry32(22668);
  contacts = Array.from({ length: 92 }, (_, index) => {
    const machine = index < 46;
    const kind = machine ? 22668 : [1, 1059, 30078, 30382, 5][index % 5];
    return {
      x: 40 + random() * (width - 80),
      y: 40 + random() * (height - 80),
      radius: machine ? 1.5 + random() * 1.8 : 1 + random() * 2.2,
      kind,
      machine,
      phase: random() * Math.PI * 2,
      speed: .3 + random() * .8,
    };
  });
}

function draw(time) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  phase = time / 1000;

  drawRadar(width, height);
  const mode = cockpit.dataset.craft;
  for (const [index, contact] of contacts.entries()) {
    const pulse = 1 + Math.sin(phase * contact.speed + contact.phase) * .35;
    const activeSensors = [...document.querySelectorAll('.sensor.active')]
      .map(({ dataset }) => dataset.sensor);
    let color = contact.machine ? '#53e68a' : '#ffb642';
    let alpha = .35;
    if (activeSensors.includes('echo') && contact.machine) alpha = .9;
    if (activeSensors.includes('kind') && contact.kind === 22668) {
      color = '#ffb642';
      alpha = 1;
    }
    if (mode === 'darkroom') {
      color = contact.kind === 22668 ? '#63d8df' : '#ffb642';
      alpha *= .45;
    }
    if (mode === 'anatomical') {
      color = '#ef476f';
      alpha *= .55;
    }
    context.beginPath();
    context.fillStyle = hexAlpha(color, alpha);
    context.shadowColor = color;
    context.shadowBlur = index === selectedContact ? 18 : 5;
    context.arc(contact.x, contact.y, contact.radius * pulse, 0, Math.PI * 2);
    context.fill();
    if (activeSensors.includes('echo') && contact.machine && index % 5 === 0) {
      context.beginPath();
      context.strokeStyle = hexAlpha(color, .12);
      context.arc(contact.x, contact.y, 8 + (phase * 7 + index) % 24, 0, Math.PI * 2);
      context.stroke();
    }
  }
  context.shadowBlur = 0;
  requestAnimationFrame(draw);
}

function drawRadar(width, height) {
  context.strokeStyle = '#67e69a14';
  context.lineWidth = 1;
  const radius = Math.min(width, height) * .17;
  for (let ring = 1; ring < 5; ring += 1) {
    context.beginPath();
    context.arc(width / 2, height / 2, radius * ring, 0, Math.PI * 2);
    context.stroke();
  }
  context.save();
  context.translate(width / 2, height / 2);
  context.rotate(phase * .16);
  const sweep = context.createLinearGradient(0, 0, radius * 4, 0);
  sweep.addColorStop(0, '#53e68a44');
  sweep.addColorStop(1, '#53e68a00');
  context.fillStyle = sweep;
  context.beginPath();
  context.moveTo(0, 0);
  context.arc(0, 0, radius * 4, -.13, .13);
  context.closePath();
  context.fill();
  context.restore();
}

document.querySelectorAll('[data-select]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.craft-selector .selected')?.classList.remove('selected');
    button.classList.add('selected');
    const selected = button.dataset.select;
    cockpit.dataset.craft = selected;
    craftName.textContent = craft[selected].name;
    log('CFG', craft[selected].message);
  });
});

document.querySelectorAll('.sensor').forEach((sensor) => {
  sensor.addEventListener('click', () => {
    sensor.classList.toggle('active');
    log('SNS', `${sensor.dataset.sensor} sensor ${sensor.classList.contains('active') ? 'online' : 'cold'}`);
  });
});

document.querySelector('#range').addEventListener('input', ({ target }) => {
  document.querySelector('#range-output').textContent = target.value;
  document.querySelector('#range-label').textContent = `RANGE ${target.value} EVENTS`;
  document.querySelector('#buffer-fill').style.width = `${target.value / 10}%`;
});

document.querySelector('#pulse').addEventListener('click', () => {
  selectedContact = (selectedContact + 13) % contacts.length;
  const contact = contacts[selectedContact];
  reticleLabel.textContent = `KIND ${contact.kind} // CONTACT LOCK`;
  document.querySelector('.reticle').style.left = `${contact.x / canvas.clientWidth * 100}%`;
  document.querySelector('.reticle').style.top = `${contact.y / canvas.clientHeight * 100}%`;
  log('PULSE', `contact ${selectedContact} acquired · kind ${contact.kind}`);
});

document.querySelector('#thrust').addEventListener('click', () => {
  commands += 1;
  commandCount.textContent = `${commands} COMMANDS`;
  log('NAV', `probe advanced to contact ${selectedContact}; path remains retractable`);
  document.querySelector('#probe-path').classList.toggle('energized');
});

document.querySelector('#retract').addEventListener('click', () => {
  commands += 1;
  commandCount.textContent = `${commands} COMMANDS`;
  log('NAV', 'probe retracted one visible joint; collected specimens retained');
});

document.querySelector('#pull-left').addEventListener('click', () => pull('left'));
document.querySelector('#pull-right').addEventListener('click', () => pull('right'));

function pull(side) {
  const specimens = document.querySelector(`#${side}-specimens`);
  if (specimens.children.length < 6) specimens.append(document.createElement('i'));
  const count = document.querySelector(`#${side}-count`);
  count.textContent = Number.parseInt(count.textContent, 10) + 1;
  log('CARGO', `current contact pulled into ${side} reservoir`);
}

document.querySelector('#command-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector('#command');
  if (!input.value.trim()) return;
  commands += 1;
  commandCount.textContent = `${commands} COMMANDS`;
  log('CMD', input.value.trim());
  input.value = '';
});

document.querySelector('#new-question').addEventListener('click', () => {
  const list = document.querySelector('#questions');
  const item = document.createElement('li');
  item.innerHTML = `<b>${String(list.children.length + 1).padStart(2, '0')}</b><span>UNFORMED QUESTION CHANNEL</span>`;
  list.append(item);
  log('NAV', 'new question channel opened; no conclusion assigned');
});

function log(kind, text) {
  const line = document.createElement('p');
  line.innerHTML = `<b>${kind}</b> ${escapeHtml(text)}`;
  terminal.append(line);
  while (terminal.children.length > 5) terminal.firstElementChild.remove();
}

function hexAlpha(hex, alpha) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

setInterval(() => {
  document.querySelector('#clock').textContent = new Date().toLocaleTimeString('en-GB');
}, 1000);

addEventListener('resize', resize);
resize();
requestAnimationFrame(draw);
