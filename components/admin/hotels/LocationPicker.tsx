'use client'

import { useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { MapPin } from 'lucide-react'

// Fix Leaflet default marker icon in Next.js
const defaultIcon = L.icon({
  iconUrl: '/leaflet-images/marker-icon.png',
  iconRetinaUrl: '/leaflet-images/marker-icon-2x.png',
  shadowUrl: '/leaflet-images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Fallback if images don't exist
const fallbackIcon = L.divIcon({
  className: 'custom-marker',
  html: '<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

interface LocationPickerProps {
  lat?: number
  lng?: number
  onChange: (lat: number, lng: number) => void
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export function LocationPicker({ lat = 11.5564, lng = 104.9282, onChange }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>([lat, lng])

  const handleClick = useCallback(
    (newLat: number, newLng: number) => {
      setPosition([newLat, newLng])
      onChange(newLat, newLng)
    },
    [onChange]
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="size-4" />
        <span>
          Lat: {position[0].toFixed(6)}, Lng: {position[1].toFixed(6)}
        </span>
      </div>
      <div className="rounded-lg overflow-hidden border border-border-default" style={{ height: 280 }}>
        <MapContainer
          center={position}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} icon={fallbackIcon} />
          <MapClickHandler onClick={handleClick} />
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">Click on the map to set the hotel location</p>
    </div>
  )
}
