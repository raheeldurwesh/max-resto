// src/hooks/useConfig.js
// UPDATED: supports restaurant_id scoping

import { useState, useEffect, useCallback } from 'react'
import {
  fetchConfig, saveConfig as svcSave,
  subscribeToConfig, DEFAULT_CONFIG,
} from '../services/configService'

export function useConfig(restaurantId) {
  const [config,  setConfig]  = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchConfig(restaurantId)
      setConfig(data)
    } catch (err) {
      console.error('useConfig error:', err)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    load()
    const unsub = subscribeToConfig(() => load(), restaurantId)
    return unsub
  }, [load, restaurantId])

  const saveConfig = async (updates) => {
    await svcSave(updates, restaurantId)
    setConfig(prev => ({ ...prev, ...updates }))
  }

  const taxNum = Number(config.tax_percentage)
  const tablesNum = parseInt(config.total_tables, 10)
  
  const settings = {
    taxPercentage: isNaN(taxNum) || taxNum < 0 ? 8 : taxNum,
    totalTables: isNaN(tablesNum) || tablesNum < 1 ? (config.total_tables || 20) : tablesNum,
  }

  const saveSettings = ({ taxPercentage, totalTables }) =>
    saveConfig({ 
      tax_percentage: Number(taxPercentage),
      total_tables: parseInt(totalTables, 10)
    })

  return { config, settings, loading, saveConfig, saveSettings }
}
