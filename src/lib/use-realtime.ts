import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export function useRealtime(
  tables: string[],
  onUpdate: () => void,
  eventId?: string
) {
  const callbackRef = useRef(onUpdate)
  callbackRef.current = onUpdate
  const [live, setLive] = useState(false)

  useEffect(() => {
    const channelName = `rt-${tables.join('-')}-${eventId ?? 'global'}`
    const channel = supabase.channel(channelName)

    for (const table of tables) {
      const opts = eventId
        ? { event: '*' as const, schema: 'public', table, filter: `event_id=eq.${eventId}` }
        : { event: '*' as const, schema: 'public', table }
      channel.on('postgres_changes', opts, () => callbackRef.current())
    }

    channel.subscribe((status) => {
      setLive(status === 'SUBSCRIBED')
    })

    return () => { supabase.removeChannel(channel) }
  }, [tables.join(','), eventId])

  return { live }
}
