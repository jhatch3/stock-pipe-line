// UI: Untitled UI Badge — https://www.untitledui.com/react/components/badges
import { Badge } from '@/components/base/badges/badges'
import { SECTOR_BADGE_COLOR } from '../lib/constants.js'

export default function SectorBadge({ sector, size = 'sm', className }) {
  if (!sector) return null
  return (
    <Badge type="color" size={size} color={SECTOR_BADGE_COLOR[sector] ?? 'gray'} className={className}>
      {sector}
    </Badge>
  )
}
