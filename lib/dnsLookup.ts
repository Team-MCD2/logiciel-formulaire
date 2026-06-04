import dns from 'dns';
import { promisify } from 'util';
import { blacklistTarget } from './blacklist';

const reverseDns = promisify(dns.reverse);

// Common VPS/VPN/Hosting keywords in hostname
const HOSTING_KEYWORDS = [
  'vps', 'vpn', 'server', 'cloud', 'host', 'dedi', 'ovh', 'aws', 'amazon',
  'digitalocean', 'linode', 'hetzner', 'leaseweb', 'scalyr', 'scaleway',
  'm247', 'controld', 'windscribe', 'nordvpn', 'surfshark', 'expressvpn',
  'proton', 'mullvad', 'ivacy', 'cyberghost', 'tor-exit', 'node', 'datacentre',
  'datacenter', 'proxy', 'rackspace', 'softlayer', 'googleusercontent'
];

/**
 * Resolves an IP to its hostnames and returns the primary domain host or null.
 * (Runs only on Node.js Server runtime).
 */
export async function resolveHostDomain(ip: string): Promise<string | null> {
  try {
    // Basic validation to avoid looking up local addresses
    if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return null;
    }
    
    const hostnames = await reverseDns(ip);
    if (hostnames && hostnames.length > 0) {
      // Return the first resolved hostname
      return hostnames[0].toLowerCase();
    }
  } catch (err) {
    // DNS resolution failure is expected for residential IPs or missing PTR records
  }
  return null;
}

/**
 * Fully handles the Honeypot trigger scenario:
 * 1. Blacklists the IP address.
 * 2. Attempts reverse DNS lookup to identify VPN/VPS hosts.
 * 3. Blacklists the resolved host if hosting keywords are present.
 * 4. Logs everything as honeypot trigger.
 * (Runs only on Node.js Server runtime).
 */
export async function handleHoneypotTrigger(ipAddress: string, fingerprint: string): Promise<void> {
  console.warn(`[SECURITY WARN] Honeypot triggered by IP: ${ipAddress}, Fingerprint: ${fingerprint}`);
  
  // 1. Blacklist the IP address immediately
  await blacklistTarget(ipAddress, 'ip', 'Honeypot Triggered');
  
  // 2. Blacklist the fingerprint
  if (fingerprint) {
    await blacklistTarget(fingerprint, 'fingerprint', 'Honeypot Triggered');
  }

  // 3. Reverse lookup and blacklist host domain if matches keywords
  const resolvedHost = await resolveHostDomain(ipAddress);
  if (resolvedHost) {
    const isHostingOrVpn = HOSTING_KEYWORDS.some(keyword => resolvedHost.includes(keyword));
    const reason = isHostingOrVpn ? 'Honeypot Triggered (Hosting/VPN Host)' : 'Honeypot Triggered (Host)';
    await blacklistTarget(resolvedHost, 'host', reason);
  }
}
