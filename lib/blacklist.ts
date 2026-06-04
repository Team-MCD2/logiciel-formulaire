import { supabase } from './supabase';

/**
 * Checks if a given target (IP, fingerprint, or host) is blacklisted.
 */
export async function isBlacklisted(target: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blacklist')
    .select('id')
    .eq('target', target)
    .limit(1);

  if (error) {
    console.error('Error checking blacklist:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Bans a target (IP, Fingerprint, or Hostname) in the blacklist database table.
 */
export async function blacklistTarget(target: string, type: 'ip' | 'fingerprint' | 'host', reason: string): Promise<void> {
  // Upsert to prevent duplicate key errors
  const { error } = await supabase
    .from('blacklist')
    .insert([{ target, type, reason }]);

  if (error && error.code !== '23505') { // Ignore duplicate key errors (code 23505 in PG)
    console.error(`Failed to blacklist ${type} "${target}":`, error);
  }
}
