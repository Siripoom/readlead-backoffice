import 'server-only'

import {
  getAllDistricts,
  getAllProvinces,
  getAllSubdistricts,
} from 'geothai'

export interface ThaiAddressOption {
  code: string
  name: string
  postalCode?: string
}

export function listProvinces(): ThaiAddressOption[] {
  return getAllProvinces()
    .map((item) => ({ code: String(item.code), name: item.name_th }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

export function listDistricts(provinceCode: string): ThaiAddressOption[] {
  const province = Number(provinceCode)
  if (!Number.isInteger(province)) return []
  return getAllDistricts()
    .filter((item) => item.province_code === province)
    .map((item) => ({ code: String(item.code), name: item.name_th }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

export function listSubdistricts(provinceCode: string, districtCode: string): ThaiAddressOption[] {
  const province = Number(provinceCode)
  const district = Number(districtCode)
  if (!Number.isInteger(province) || !Number.isInteger(district)) return []
  return getAllSubdistricts()
    .filter((item) => item.province_code === province && item.district_code === district)
    .map((item) => ({ code: String(item.code), name: item.name_th, postalCode: String(item.postal_code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

export function resolveThaiAddress(provinceCode: string, districtCode: string, subdistrictCode: string) {
  const province = getAllProvinces().find((item) => String(item.code) === provinceCode)
  const district = getAllDistricts().find((item) => (
    String(item.code) === districtCode && String(item.province_code) === provinceCode
  ))
  const subdistrict = getAllSubdistricts().find((item) => (
    String(item.code) === subdistrictCode
    && String(item.district_code) === districtCode
    && String(item.province_code) === provinceCode
  ))

  if (!province || !district || !subdistrict) return null
  return {
    provinceCode,
    provinceName: province.name_th,
    districtCode,
    districtName: district.name_th,
    subdistrictCode,
    subdistrictName: subdistrict.name_th,
    postalCode: String(subdistrict.postal_code),
  }
}
