'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Siswa } from '@/lib/types'

const supabase = createClient()

interface OrtuChildContextType {
  activeChild: Siswa | null
  childrenList: Siswa[]
  setActiveChildId: (id: string) => void
  loading: boolean
  refreshChildren: () => Promise<void>
}

const OrtuChildContext = createContext<OrtuChildContextType>({
  activeChild: null,
  childrenList: [],
  setActiveChildId: () => {},
  loading: true,
  refreshChildren: async () => {}
})

export function OrtuChildProvider({ children }: { children: React.ReactNode }) {
  const [activeChild, setActiveChild] = useState<Siswa | null>(null)
  const [childrenList, setChildrenList] = useState<Siswa[]>([])
  const [loading, setLoading] = useState(true)

  const fetchChildren = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('siswa_id')
        .eq('id', user.id)
        .single()

      if (!profile?.siswa_id) {
        setLoading(false)
        return
      }

      // 1. Ambil data siswa utama yang terhubung di profile
      const { data: primarySiswa } = await supabase
        .from('siswa')
        .select('*, program_kelas(nama_program)')
        .eq('id', profile.siswa_id)
        .single()

      if (!primarySiswa) {
        setLoading(false)
        return
      }

      let allSiblings: Siswa[] = [primarySiswa as Siswa]

      // 2. Jika no_hp_ortu terisi, cari anak-anak lain yang nomor HP ortunya sama
      if (primarySiswa.no_hp_ortu) {
        const cleanHP = primarySiswa.no_hp_ortu.trim()
        const { data: siblingData } = await supabase
          .from('siswa')
          .select('*, program_kelas(nama_program)')
          .eq('no_hp_ortu', cleanHP)
          .eq('status_aktif', true)
          .order('nama', { ascending: true })

        if (siblingData && siblingData.length > 0) {
          const map = new Map<string, Siswa>()
          map.set(primarySiswa.id, primarySiswa as Siswa)
          for (const s of siblingData) {
            map.set(s.id, s as Siswa)
          }
          allSiblings = Array.from(map.values())
        }
      }

      setChildrenList(allSiblings)

      // 3. Tentukan active child (cek localStorage jika ada)
      const savedChildId = typeof window !== 'undefined' ? localStorage.getItem('siger_active_child_id') : null
      const matchedSaved = allSiblings.find(s => s.id === savedChildId)

      if (matchedSaved) {
        setActiveChild(matchedSaved)
      } else {
        setActiveChild(allSiblings[0] || (primarySiswa as Siswa))
      }
    } catch (err) {
      console.error('Error loading parent children:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  const setActiveChildId = (id: string) => {
    const found = childrenList.find(s => s.id === id)
    if (found) {
      setActiveChild(found)
      if (typeof window !== 'undefined') {
        localStorage.setItem('siger_active_child_id', id)
      }
    }
  }

  return (
    <OrtuChildContext.Provider
      value={{
        activeChild,
        childrenList,
        setActiveChildId,
        loading,
        refreshChildren: fetchChildren
      }}
    >
      {children}
    </OrtuChildContext.Provider>
  )
}

export function useOrtuChild() {
  return useContext(OrtuChildContext)
}
