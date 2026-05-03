'use server'

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, '')
  )
}

// EVENTS
export async function createEvent(form: {
  name: string; date: string; date_end: string; time_start: string; time_end: string
  location: string; type: string; status: string; description: string
}) {
  const supabase = getSupabase()
  const payload = {
    name: form.name,
    date: form.date || null,
    date_end: form.date_end || null,
    time_start: form.time_start || null,
    time_end: form.time_end || null,
    location: form.location || null,
    type: form.type || null,
    status: form.status,
    description: form.description || null,
  }
  const { data, error } = await supabase.from('events').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateEvent(id: string, form: {
  name: string; date: string; date_end: string; time_start: string; time_end: string
  location: string; type: string; status: string; description: string
}) {
  const supabase = getSupabase()
  const payload = {
    name: form.name,
    date: form.date || null,
    date_end: form.date_end || null,
    time_start: form.time_start || null,
    time_end: form.time_end || null,
    location: form.location || null,
    type: form.type || null,
    status: form.status,
    description: form.description || null,
  }
  const { error } = await supabase.from('events').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// EXPENSES
export async function createExpense(payload: {
  event_id: string; category: string; item: string; note: string | null;
  payment_timing: string | null; price: number; deposit: number; paid: boolean
}) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('expenses').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateExpense(id: string, payload: {
  category: string; item: string; note: string | null;
  payment_timing: string | null; price: number; deposit: number; paid: boolean
}) {
  const supabase = getSupabase()
  const { error } = await supabase.from('expenses').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteExpense(id: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function toggleExpensePaid(id: string, paid: boolean) {
  const supabase = getSupabase()
  const { error } = await supabase.from('expenses').update({ paid }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// INCOME
export async function createIncome(payload: {
  event_id: string; source: string; amount: number; note: string | null
}) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('income').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateIncome(id: string, payload: {
  source: string; amount: number; note: string | null
}) {
  const supabase = getSupabase()
  const { error } = await supabase.from('income').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteIncome(id: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('income').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// LINEUP
export async function createArtist(payload: {
  event_id: string; artist_name: string; fee: number; deposit: number;
  paid: boolean; set_time: string | null; notes: string | null
}) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('lineup').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateArtist(id: string, payload: {
  artist_name: string; fee: number; deposit: number;
  paid: boolean; set_time: string | null; notes: string | null
}) {
  const supabase = getSupabase()
  const { error } = await supabase.from('lineup').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteArtist(id: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('lineup').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function toggleArtistPaid(id: string, paid: boolean) {
  const supabase = getSupabase()
  const { error } = await supabase.from('lineup').update({ paid }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// TEAM
export async function createContribution(payload: {
  event_id: string; name: string; amount: number; note: string | null
}) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('team_contributions').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateContribution(id: string, payload: {
  name: string; amount: number; note: string | null
}) {
  const supabase = getSupabase()
  const { error } = await supabase.from('team_contributions').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteContribution(id: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('team_contributions').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

// TASKS
export async function createTask(payload: {
  title: string; description: string | null; assigned_to: string | null;
  status: string; priority: string; due_date: string | null; event_id: string | null
}) {
  const supabase = getSupabase()
  const { data, error } = await supabase.from('tasks').insert([payload]).select().single()
  if (error) return { error: error.message }
  return { data }
}

export async function updateTask(id: string, payload: {
  title: string; description: string | null; assigned_to: string | null;
  status: string; priority: string; due_date: string | null; event_id: string | null
}) {
  const supabase = getSupabase()
  const { error } = await supabase.from('tasks').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function updateTaskStatus(id: string, status: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}

export async function deleteTask(id: string) {
  const supabase = getSupabase()
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return { error: error.message }
  return { data: true }
}
