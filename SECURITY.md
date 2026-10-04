# Security and publication notes

The published history omits captured images, datasets, trained models, runtime logs,
private configuration and account seed data. Contributor metadata and the development
history are retained. This reduces repository disclosure risks; it is not a production
security certification.

## Configuration

- Never commit `.env` files, keys, database dumps or camera recordings. The root ignore
  rules cover common variants, but Git ignore rules do not erase previously committed data.
- Generate separate database, MQTT and JWT secrets for every environment. No real secret
  is supplied by the examples. Frontend `VITE_*` variables are public, including mock passwords.
- The Compose examples bind app/local infrastructure ports to localhost, or keep them
  inside Docker. MQTT rejects anonymous connections. Its shared demonstration credential
  and station-topic ACL must be replaced with per-device credentials, narrowly scoped ACLs
  and TLS before connecting untrusted devices or networks.
- A broker password alone does not establish face-authentication evidence or authorize
  arbitrary station/user identifiers. Enforce that binding in the trusted device/backend path.
- The kiosk does not embed a fixed stream token. A camera proxy must authenticate every
  request with short-lived sessions, enforce origin/access controls and avoid public feeds.
  There is no such proxy implementation in this repository. Browser URLs must not carry secrets.
- Raw Pi WebSocket payloads and close reasons are not logged by the kiosk. Do not enable
  debug logging of identities, biometrics, credentials or LLM conversation contents in production.
- Production admin UI builds ignore the development authentication bypass. Mock login
  only demonstrates UI behavior and cannot secure backend APIs.

## Remaining deployment work

The server currently validates the admin JWT absolute expiry but does not enforce a
server-side idle session timeout or token revocation on logout. The UI's idle handling
does not provide those guarantees. Complete the session/logout API and server enforcement
before using real administrator accounts. Add rate limits and appropriate account controls.

Use HTTPS/WSS, TLS for remote database/MQTT traffic, strict CORS, protected management
endpoints and an appropriate deployment configuration. The Compose files are local examples.
Set up image/biometric consent, retention and deletion rules before collecting real data.
Validate face-authentication evidence, station authorization and physical device behavior.

Frontend lockfiles were refreshed during preparation. On 2026-10-04 the npm registry
advisory lookup matched no kiosk packages and one admin-web package: `braces@3.0.3`
([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)), a high-severity
stack-exhaustion issue with no published patched version. It is reached through Tailwind's
build-time glob dependencies; the configured content globs are fixed repository patterns.
Do not feed untrusted patterns to build tools. Reassess when an upstream fix becomes available.
This lookup checks exact lockfile versions; it does not prove absence of exploitable bugs.

Re-run dependency auditing when
changing or publishing dependencies. Python and JVM dependencies still need their own
advisory assessment and supported deployment testing. AI data/model provenance and
third-party asset licensing must be checked separately.

## Reporting

Do not post credentials, personal data or exploit details in public issues. Use GitHub's
private vulnerability reporting if enabled, or a private contact channel agreed with the owner.
