export const OPEN_AT = Date.parse('2026-10-08T17:51:52Z');
export const CLOSE_AT = Date.parse('2026-10-09T04:20:13Z');
export function intakeOpen(now = Date.now()) {
  return Number.isFinite(now) && now >= OPEN_AT && now < CLOSE_AT;
}
const subject = 'Express CSV review — sample fit';
const body = 'Please check whether this fits the $35 express review.\n\nColumn names and up to 10 anonymized rows from each file:\n\nWhat the numeric field represents (same units/currency in both files):\n\nI understand that scope, complete inputs, start time and availability must be confirmed before work is accepted.';
export const CONTACT_URL = 'mailto:logantbaird@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
export function refreshOffer(root, now = Date.now()) {
  const open = intakeOpen(now);
  root.getElementById('service-title').textContent = open ? '$35 express CSV review' : 'Paid review intake is closed.';
  root.getElementById('service-status').textContent = open ? 'Fixed scope · sample check first' : 'No new paid reviews are being accepted.';
  root.getElementById('service-closed').hidden = open;
  for (const id of ['service-terms', 'service-price', 'service-contact', 'service-sample']) root.getElementById(id).hidden = !open;
  const contact = root.getElementById('service-contact');
  if (open) contact.setAttribute('href', CONTACT_URL);
  else contact.removeAttribute('href');
  return open;
}
if (typeof document !== 'undefined') {
  const refresh = () => refreshOffer(document);
  refresh();
  setInterval(refresh, 15000);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
  document.getElementById('service-contact').addEventListener('click', event => {
    if (!refresh()) event.preventDefault();
  });
}
