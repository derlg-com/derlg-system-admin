'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'

interface NearbyPlace {
  name: string
  lat: number
  lng: number
  type: 'hospital' | 'police' | 'hotel'
}

interface EmergencyMapProps {
  lat: number
  lng: number
  alertType?: string
  radius?: number
  nearbyPlaces?: NearbyPlace[]
}

function createIcon(html: string) {
  return L.divIcon({
    className: 'custom-emergency-marker',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  })
}

const ALERT_ICON_COLORS: Record<string, string> = {
  SOS: '#ef4444',
  MEDICAL: '#f59e0b',
  THEFT: '#8b5cf6',
  LOST: '#06b6d4',
}

function alertIconHtml(type: string): string {
  const color = ALERT_ICON_COLORS[type] || ALERT_ICON_COLORS.SOS
  // Alert triangle SVG
  return `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  </div>`
}

function placeIconHtml(type: string): string {
  const colors: Record<string, string> = { hospital: '#22c55e', police: '#3b82f6', hotel: '#8b5cf6' }
  const color = colors[type] || '#64748b'
  let svg = ''
  if (type === 'hospital') {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>'
  } else if (type === 'police') {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>'
  } else {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>'
  }
  return `<div style="background:${color};width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${svg}</div>`
}

export function EmergencyMap({ lat, lng, alertType = 'SOS', radius = 500, nearbyPlaces = [] }: EmergencyMapProps) {
  const position: [number, number] = [lat, lng]

  const alertIcon = useMemo(() => createIcon(alertIconHtml(alertType)), [alertType])

  return (
    <div className="rounded-lg overflow-hidden border border-border-default" style={{ height: 360 }}>
      <MapContainer
        center={position}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={position}
          radius={radius}
          pathOptions={{
            color: ALERT_ICON_COLORS[alertType] || ALERT_ICON_COLORS.SOS,
            fillColor: ALERT_ICON_COLORS[alertType] || ALERT_ICON_COLORS.SOS,
            fillOpacity: 0.1,
            weight: 2,
          }}
        />
        <Marker position={position} icon={alertIcon}>
          <Popup>
            <div className="text-sm font-medium">
              {alertType} Alert Location
            </div>
            <div className="text-xs text-muted-foreground">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </div>
          </Popup>
        </Marker>
        {nearbyPlaces.map((place, i) => {
          const placeIcon = createIcon(placeIconHtml(place.type))
          return (
            <Marker key={i} position={[place.lat, place.lng]} icon={placeIcon}>
              <Popup>
                <div className="text-sm font-medium capitalize">{place.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{place.type}</div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
