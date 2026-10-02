import { hash3 } from '../core/rng';
import { lanHosts, techOnline } from './network';
import { Sec } from './wifi';
import { type World } from './world';

/**
 * The packets a sniffer sees on a Wi-Fi network, materialized from the simulation's flows only when
 * something is capturing (the packet tool, a log, a future IDS). Nothing runs without a capture, so
 * it costs nothing the rest of the time; given the same seed and the same moment it gives the same
 * trace. The flows are the usual traffic of a network of the time (a shop browsing the web, a
 * substation technician logged into the controller), broken into real-looking frames: 802.11
 * management, the WPA four-way handshake, ARP, DHCP, DNS, TCP with its sequence numbers and HTTP.
 * Frames are lost from a weak signal (the radio's dBm) and then retransmitted.
 *
 * What reads in the clear follows the encryption: an open network shows everything; a WEP or WPA
 * network the station is associated with (it holds the key) decrypts; another station's WPA traffic
 * stays protected unless its handshake was captured in the window. All names are fictional.
 */
export interface Packet { t: number; info: string; ink: 0 | 1 | 2 }

const HOSTS = ['portal', 'mail', 'news', 'search', 'weather', 'maps', 'forum', 'market'];
const TLD = ['.net', '.com', '.org'];
const PATHS = ['/', '/index.html', '/login', '/inbox', '/news/', '/img/logo.gif', '/style.css'];

/** Capture `span` seconds of traffic on access point `ap`, at signal `dbm`; at most `limit` frames. */
export function capture(w: World, ap: number, ssid: string, dbm: number, atTime: number, span: number, limit: number): Packet[] {
  const A = w.wifi[ap], ch = A.ch, bssid = A.bssid, gw = `192.168.${ch}.1`;
  const open = A.sec === Sec.Open, wep = A.sec === Sec.WEP, wpa = A.sec === Sec.WPA;
  const win = Math.floor(atTime);
  const h = (k: number) => hash3(w.seed ^ 0x9ac1, ap, win * 97 + k);
  const pLoss = Math.max(0, Math.min(0.5, (-dbm - 62) / 40));
  const P: Packet[] = [];
  const mac = (k: number) => Array.from({ length: 6 }, (_, i) => Math.floor(h(700 + k * 6 + i) * 256).toString(16).padStart(2, '0')).join(':').toUpperCase();
  const seqOf = (k: number) => Math.floor(h(k) * 4e9);
  // an air frame: it may be lost (from the signal) and then retransmitted after a short wait
  const air = (t: number, info: string, ink: 0 | 1 | 2, retry = true) => {
    if (retry && h(Math.floor(t * 1000) + 3) < pLoss) {
      P.push({ t, info: info + '  [lost]', ink: 1 });
      P.push({ t: t + 0.004 + h(Math.floor(t * 1000) + 4) * 0.02, info: info + '  [retransmission]', ink });
    } else P.push({ t, info, ink });
  };
  const webFlow = (t: number, sip: string, smac: string, cleartext: boolean, idx: number) => {
    const host = HOSTS[Math.floor(h(idx * 7 + 1) * HOSTS.length)] + TLD[Math.floor(h(idx * 7 + 2) * TLD.length)];
    const wip = `${64 + Math.floor(h(idx * 7 + 3) * 120)}.${Math.floor(h(idx * 7 + 4) * 255)}.${Math.floor(h(idx * 7 + 5) * 255)}.${1 + Math.floor(h(idx * 7 + 6) * 253)}`;
    const sport = 1024 + Math.floor(h(idx * 7) * 64000), seq = seqOf(idx * 11), ack = seqOf(idx * 13);
    air(t, `ARP           who-has ${gw} tell ${sip}`, 1);
    air(t + 0.002, `ARP           reply ${gw} is-at ${mac(0)}`, 1);
    if (cleartext) {
      air(t + 0.02, `DNS           ${sip}.${sport} > ${gw}.53  A? ${host}`, 1);
      air(t + 0.06, `DNS           ${gw}.53 > ${sip}  A ${host} ${wip}`, 1);
    }
    air(t + 0.1, `TCP           ${sip}.${sport} > ${wip}.80  [S]  seq ${seq} win 5840 <mss 1460>`, cleartext ? 0 : 1);
    air(t + 0.16, `TCP           ${wip}.80 > ${sip}.${sport}  [S.] seq ${ack} ack ${seq + 1} win 5792`, cleartext ? 0 : 1);
    air(t + 0.18, `TCP           ${sip}.${sport} > ${wip}.80  [.]  ack ${ack + 1}`, cleartext ? 0 : 1);
    if (cleartext) {
      const path = PATHS[Math.floor(h(idx * 7 + 9) * PATHS.length)];
      air(t + 0.2, `HTTP          GET ${path} HTTP/1.1  Host: ${host}`, 0);
      const bytes = 1400 + Math.floor(h(idx * 7 + 10) * 20000), rate = 20000 + h(idx * 7 + 11) * 120000, segs = Math.min(5, Math.ceil(bytes / 1460));
      for (let s = 0; s < segs; s++) air(t + 0.26 + s * (1460 / rate), `HTTP          HTTP/1.1 200 OK  len ${Math.min(1460, bytes - s * 1460)}`, 0);
      air(t + 0.5, `TCP           ${sip}.${sport} > ${wip}.80  [F.] seq ${seq + 16} ack ${ack + 1}`, 0);
    } else for (let s = 0; s < 4; s++) air(t + 0.26 + s * 0.05, `802.11 Data   QoS ${smac} > ${bssid}  (WPA, protected) len ${200 + Math.floor(h(idx * 7 + 20 + s) * 1300)}`, 1);
  };
  // the AP's beacons (a real AP beacons ~10x a second; thinned here so the flows stay legible)
  for (let t = 0.03, k = 0; t < span; t += 0.45 + h(k) * 0.12, k++)
    air(t, `Beacon        ${bssid} SSID "${ssid}" ch ${ch} 54Mb ${open ? 'ESS' : wep ? 'ESS PRIVACY' : 'ESS PRIVACY RSN'}`, 1, false);
  const hosts = lanHosts(w, ap);
  // a station that (re)joins during the capture: auth, association, and on WPA the four-way handshake
  let joinerClear = false;
  if ((wpa || wep) && h(1) < 0.8) {
    const t = 0.4 + h(2) * 1.2, smac = mac(1), sip = `192.168.${ch}.${120 + Math.floor(h(3) * 40)}`;
    air(t, `Probe Request SSID "${ssid}" ${smac} > Broadcast`, 1);
    air(t + 0.03, `Probe Response ${bssid} > ${smac}`, 1);
    air(t + 0.08, `Authentication (Open System) ${smac} > ${bssid} seq 1`, 1);
    air(t + 0.1, `Authentication (Open System) ${bssid} > ${smac} seq 2 status 0`, 1);
    air(t + 0.14, `Association Request ${smac} > ${bssid}`, 1);
    air(t + 0.17, `Association Response ${bssid} > ${smac} status 0 AID 1`, 1);
    if (wpa) {
      air(t + 0.22, `EAPOL-Key     (1/4) ${bssid} > ${smac} ANonce`, 2);
      air(t + 0.25, `EAPOL-Key     (2/4) ${smac} > ${bssid} SNonce MIC`, 2);
      air(t + 0.28, `EAPOL-Key     (3/4) ${bssid} > ${smac} Install GTK MIC`, 2);
      air(t + 0.31, `EAPOL-Key     (4/4) ${smac} > ${bssid} MIC`, 2);
      joinerClear = true; // with the PSK and this handshake, this station's traffic can be read
    }
    air(t + 0.4, `DHCP          Discover ${smac}`, 1);
    air(t + 0.5, `DHCP          Offer ${gw} > ${sip}`, 1);
    air(t + 0.55, `DHCP          Request ${smac} for ${sip}`, 1);
    air(t + 0.6, `DHCP          ACK ${gw} > ${sip} lease 43200s`, 1);
    webFlow(t + 0.8, sip, smac, open || wep || joinerClear, 5);
  }
  // an already-associated station browsing (its WPA traffic stays protected: no captured handshake)
  webFlow(1.0 + h(10) * 2, `192.168.${ch}.${100 + Math.floor(h(11) * 18)}`, mac(2), open || wep, 8);
  // a utility network: the technician's cleartext telnet and modbus to the RTU (we hold the WEP key)
  if (A.util >= 0 && techOnline(w, A.util)) {
    const rtu = hosts.find((x) => x.kind === 'rtu')!;
    const t = 1.6 + h(20) * 1.5, sip = `192.168.${ch}.${50 + Math.floor(h(21) * 6)}`, sport = 1024 + Math.floor(h(22) * 60000), seq = seqOf(40), ack = seqOf(41);
    air(t, `ARP           who-has ${rtu.ip} tell ${sip}`, 1);
    air(t + 0.01, `ARP           reply ${rtu.ip} is-at ${rtu.mac}`, 1);
    air(t + 0.05, `TCP           ${sip}.${sport} > ${rtu.ip}.23  [S]  seq ${seq} win 5840`, 0);
    air(t + 0.1, `TCP           ${rtu.ip}.23 > ${sip}.${sport}  [S.] seq ${ack} ack ${seq + 1} win 5792`, 0);
    air(t + 0.12, `TCP           ${sip}.${sport} > ${rtu.ip}.23  [.]  ack ${ack + 1}`, 0);
    air(t + 0.2, `TELNET        ${rtu.ip}.23 > ${sip}  "${rtu.name} login: "`, 0);
    air(t + 0.6, `TELNET        ${sip} > ${rtu.ip}.23  data "${rtu.user}\\r"`, 2);
    air(t + 0.7, `TELNET        ${rtu.ip}.23 > ${sip}  "Password: "`, 0);
    air(t + 1.1, `TELNET        ${sip} > ${rtu.ip}.23  data "${rtu.pass}\\r"`, 2);
    air(t + 1.3, `TELNET        ${rtu.ip}.23 > ${sip}  "RTU-300 ready"`, 0);
    air(t + 1.6, `Modbus/TCP    ${sip} > ${rtu.ip}.502  Read Holding Registers 0..7`, 1);
    air(t + 1.65, `Modbus/TCP    ${rtu.ip}.502 > ${sip}  Response 8 registers`, 1);
  }
  P.sort((a, b) => a.t - b.t);
  return P.filter((p) => p.t >= 0 && p.t < span).slice(0, limit);
}
