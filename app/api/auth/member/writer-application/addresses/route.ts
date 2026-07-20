import { NextRequest, NextResponse } from 'next/server'
import { getMemberSessionUser } from '@/lib/member-auth'
import { listDistricts, listProvinces, listSubdistricts } from '@/lib/thai-addresses'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(request: NextRequest) {
  try {
    if (!await getMemberSessionUser()) return json({ error: 'กรุณาเข้าสู่ระบบก่อนเลือกข้อมูลที่อยู่' }, 401)

    const provinceCode = request.nextUrl.searchParams.get('provinceCode')?.trim() ?? ''
    const districtCode = request.nextUrl.searchParams.get('districtCode')?.trim() ?? ''

    if (districtCode && !provinceCode) return json({ error: 'กรุณาระบุจังหวัดก่อนอำเภอ' }, 400)
    if (provinceCode && districtCode) {
      const items = listSubdistricts(provinceCode, districtCode)
      return items.length ? json({ items }) : json({ error: 'ไม่พบตำบลสำหรับพื้นที่ที่เลือก' }, 400)
    }
    if (provinceCode) {
      const items = listDistricts(provinceCode)
      return items.length ? json({ items }) : json({ error: 'ไม่พบอำเภอสำหรับจังหวัดที่เลือก' }, 400)
    }
    return json({ items: listProvinces() })
  } catch (error) {
    console.error('Thai address lookup failed', error)
    return json({ error: 'โหลดข้อมูลที่อยู่ไม่สำเร็จ' }, 500)
  }
}
