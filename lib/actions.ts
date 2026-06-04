'use server';

import { supabase } from './supabase';

// Helper: Ensure the request is authenticated via cookies (read on the server)
async function verifyAdminAuth() {
  const { cookies } = await import('next/headers');
  const { verifyJWT } = await import('./jwt');
  
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!accessToken || !JWT_SECRET) {
    throw new Error('Unauthorized access');
  }
  
  const payload = await verifyJWT(accessToken, JWT_SECRET);
  if (!payload || payload.sub !== 'admin') {
    throw new Error('Unauthorized session');
  }
}

// ==================== DASHBOARD STATS ====================

export async function getDashboardStats() {
  await verifyAdminAuth();
  
  const [
    { count: formsCount },
    { count: clientsCount },
    { count: submissionsCount },
    { count: blacklistCount },
    { data: submissions },
  ] = await Promise.all([
    supabase.from('forms').select('*', { count: 'exact', head: true }),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
    supabase.from('blacklist').select('*', { count: 'exact', head: true }),
    supabase
      .from('submissions')
      .select('id, form_id, ip_address, created_at, forms(name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return {
    formsCount: formsCount || 0,
    clientsCount: clientsCount || 0,
    submissionsCount: submissionsCount || 0,
    blacklistCount: blacklistCount || 0,
    recentSubmissions: submissions || [],
  };
}

// ==================== CLIENTS CRUD ====================

export async function getClients() {
  await verifyAdminAuth();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveClient(id: string | null, name: string, email: string, phone: string | null) {
  try {
    await verifyAdminAuth();
    if (id) {
      const { error } = await supabase
        .from('clients')
        .update({ name, email, phone: phone || null })
        .eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('clients')
        .insert([{ name, email, phone: phone || null }]);
      if (error) throw error;
    }
    return { success: true };
  } catch (err: any) {
    console.error('Error in saveClient:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function deleteClient(id: string) {
  try {
    await verifyAdminAuth();
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in deleteClient:', err);
    return { success: false, error: err.message || String(err) };
  }
}

// ==================== FORMS CRUD ====================

export async function getForms() {
  await verifyAdminAuth();
  const { data, error } = await supabase
    .from('forms')
    .select('id, name, is_active, allowed_origins, client_id, clients(name), created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getFormDetails(formId: string) {
  await verifyAdminAuth();
  const [formRes, subsRes] = await Promise.all([
    supabase
      .from('forms')
      .select('id, name, is_active, allowed_origins, auto_reply_enabled, auto_reply_subject, auto_reply_message, clients(name, email)')
      .eq('id', formId)
      .single(),
    supabase
      .from('submissions')
      .select('id, payload, ip_address, created_at')
      .eq('form_id', formId)
      .order('created_at', { ascending: false }),
  ]);

  if (formRes.error) throw formRes.error;
  return {
    form: formRes.data,
    submissions: subsRes.data || [],
  };
}

export async function createForm(
  name: string,
  clientId: string,
  allowedOrigins: string[],
  autoReplyEnabled = false,
  autoReplySubject = 'Confirmation de réception',
  autoReplyMessage = ''
) {
  try {
    await verifyAdminAuth();
    const { error } = await supabase
      .from('forms')
      .insert([
        {
          name,
          client_id: clientId,
          allowed_origins: allowedOrigins.length > 0 ? allowedOrigins : ['*'],
          is_active: true,
          auto_reply_enabled: autoReplyEnabled,
          auto_reply_subject: autoReplySubject,
          auto_reply_message: autoReplyMessage,
        },
      ]);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in createForm:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function updateFormAutoReply(
  formId: string,
  autoReplyEnabled: boolean,
  autoReplySubject: string,
  autoReplyMessage: string
) {
  try {
    await verifyAdminAuth();
    const { error } = await supabase
      .from('forms')
      .update({
        auto_reply_enabled: autoReplyEnabled,
        auto_reply_subject: autoReplySubject,
        auto_reply_message: autoReplyMessage,
      })
      .eq('id', formId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in updateFormAutoReply:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function updateFormOrigins(formId: string, allowedOrigins: string[]) {
  try {
    await verifyAdminAuth();
    const { error } = await supabase
      .from('forms')
      .update({
        allowed_origins: allowedOrigins,
      })
      .eq('id', formId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in updateFormOrigins:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function toggleFormStatus(id: string, newStatus: boolean) {
  try {
    await verifyAdminAuth();
    const { error } = await supabase
      .from('forms')
      .update({ is_active: newStatus })
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in toggleFormStatus:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function deleteForm(id: string) {
  try {
    await verifyAdminAuth();
    const { error } = await supabase.from('forms').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in deleteForm:', err);
    return { success: false, error: err.message || String(err) };
  }
}

// ==================== SUBMISSIONS CRUD ====================

export async function getSubmissions() {
  await verifyAdminAuth();
  const { data, error } = await supabase
    .from('submissions')
    .select('id, form_id, payload, ip_address, fingerprint, created_at, forms(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ==================== BLACKLIST CRUD ====================

export async function getBlacklist() {
  await verifyAdminAuth();
  const { data, error } = await supabase
    .from('blacklist')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addBlacklist(target: string, type: 'ip' | 'fingerprint' | 'host', reason: string) {
  try {
    await verifyAdminAuth();
    const { error } = await supabase
      .from('blacklist')
      .insert([{ target: target.trim().toLowerCase(), type, reason }]);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in addBlacklist:', err);
    return { success: false, error: err.message || String(err) };
  }
}

export async function removeBlacklist(id: string) {
  try {
    await verifyAdminAuth();
    const { error } = await supabase.from('blacklist').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Error in removeBlacklist:', err);
    return { success: false, error: err.message || String(err) };
  }
}
