// RYDZ Rider - Legal screens (Privacy Policy & Terms of Use)

var _PRIVACY_HTML = '<h2>Privacy Policy</h2>'
+ '<p class="legal-date">Last Updated: April 1st, 2026</p>'
+ '<h3>Your Privacy Matters</h3>'
+ '<p>Ride Rydz, LLC (\u201cRide Rydz,\u201d \u201cwe,\u201d \u201cus,\u201d or \u201cour\u201d) partners with cities, communities, and private operators to deliver reliable, on-demand transportation services. Whether we operate rides directly or provide our technology platform to partners, we are committed to protecting your personal data and ensuring transparency in how it is handled.</p>'
+ '<h3>Scope of This Policy</h3>'
+ '<p>This Privacy Policy explains how we collect, use, and share information when you:</p>'
+ '<ul><li>Use our mobile applications (\u201cApp\u201d)</li><li>Request or take rides through Ride Rydz</li><li>Interact with our services</li></ul>'
+ '<p>By using our services, you agree to the practices described in this policy.</p>'
+ '<h3>Information We Collect</h3>'
+ '<h4>1. Information You Provide</h4>'
+ '<ul><li>Name</li><li>Email address</li><li>Phone number</li><li>Password</li><li>Saved addresses (optional)</li></ul>'
+ '<p><strong>Ride details:</strong></p>'
+ '<ul><li>Pickup and drop-off</li><li>Passenger count</li><li>Notes (optional)</li><li>Payments/tips (where applicable)</li></ul>'
+ '<p><strong>Additional:</strong></p>'
+ '<ul><li>Ratings and reviews</li><li>Support communications</li></ul>'
+ '<h4>2. Automatically Collected</h4>'
+ '<ul><li>Ride history</li><li>Location (only when app is active)</li><li>Device and usage data</li></ul>'
+ '<h4>3. Third-Party Data</h4>'
+ '<p>We may receive data from partners, cities, or payment providers.</p>'
+ '<h3>How We Use Data</h3>'
+ '<ul><li>Provide and improve rides</li><li>Ensure safety and security</li><li>Communicate with users</li><li>Perform analytics and development</li><li>Meet legal obligations</li></ul>'
+ '<h3>How We Share Data</h3>'
+ '<ul><li>With drivers (ride-related info)</li><li>With cities/operators (as required)</li><li>With vendors (for operations only)</li><li>For legal compliance</li><li>During business transfers</li><li>With your consent</li></ul>'
+ '<h3>Your Choices</h3>'
+ '<ul><li>Edit/delete account</li><li>Control location sharing</li><li>Opt out of marketing emails</li></ul>'
+ '<h3>Security</h3>'
+ '<p>We use reasonable safeguards but cannot guarantee absolute security.</p>'
+ '<h3>Children</h3>'
+ '<p>Not intended for users under 18.</p>'
+ '<h3>Updates</h3>'
+ '<p>We may update this policy. Continued use constitutes acceptance.</p>'
+ '<h3>Contact Us</h3>'
+ '<p>Ride Rydz, LLC<br>Email: info@riderydz.com<br>In-App: \u201cHelp\u201d section</p>';

var _TERMS_HTML = '<h2>Terms of Use</h2>'
+ '<p class="legal-date">Last Updated: April 1st, 2026</p>'
+ '<h3>Agreement</h3>'
+ '<p>By using Ride Rydz, you agree to these Terms.</p>'
+ '<h3>Services</h3>'
+ '<p>We provide:</p>'
+ '<ul><li>Ride booking apps</li><li>Transportation coordination</li><li>Technology platform services</li></ul>'
+ '<p>Use is personal and non-commercial.</p>'
+ '<h3>User Responsibilities</h3>'
+ '<p>You must:</p>'
+ '<ul><li>Maintain accurate account info</li><li>Keep login secure</li><li>Use services legally</li></ul>'
+ '<h3>Technology</h3>'
+ '<p>You are responsible for devices and data access.</p>'
+ '<h3>Communications</h3>'
+ '<p>You agree to receive calls, texts, and emails.</p>'
+ '<h3>Disclaimers</h3>'
+ '<p>Services are provided \u201cas is.\u201d</p>'
+ '<h3>Liability</h3>'
+ '<p>Ride Rydz is not liable for indirect or incidental damages.</p>'
+ '<h3>Indemnification</h3>'
+ '<p>You agree to cover claims resulting from your misuse.</p>'
+ '<h3>Arbitration</h3>'
+ '<p>Disputes are resolved via binding arbitration, not court.</p>'
+ '<h3>Governing Law</h3>'
+ '<p>Florida law applies unless otherwise required.</p>'
+ '<h3>General</h3>'
+ '<ul><li>Terms may be updated anytime</li><li>Continued use constitutes acceptance</li></ul>'
+ '<h3>Contact</h3>'
+ '<p>Ride Rydz, LLC<br>Email: info@riderydz.com</p>';

function showLegal(type) {
  var el = document.getElementById('s-legal');
  if (!el) return;
  var title = document.getElementById('legal-title');
  var body = document.getElementById('legal-body');
  if (!title || !body) return;

  if (type === 'privacy') {
    title.textContent = 'Privacy Policy';
    body.innerHTML = _PRIVACY_HTML;
  } else {
    title.textContent = 'Terms of Use';
    body.innerHTML = _TERMS_HTML;
  }

  el.classList.add('on');
  el.scrollTop = 0;
  var sc = el.querySelector('.legal-scroll');
  if (sc) sc.scrollTop = 0;
}

function hideLegal() {
  var el = document.getElementById('s-legal');
  if (el) el.classList.remove('on');
}
