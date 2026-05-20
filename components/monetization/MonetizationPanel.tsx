'use client'
import { Card, Tabs } from '@chakra-ui/react'
import { useSearchParams } from 'next/navigation'
import { AdsTab } from './AdsTab'
import { ExpTitlesTab } from './ExpTitlesTab'
import { PricingTab } from './PricingTab'
import { PromotionsTab } from './PromotionsTab'
import { VipLevelsTab } from './VipLevelsTab'

export function MonetizationPanel() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'promotions'

  return (
    <Card.Root bg="white" shadow="sm">
      <Card.Body p={0}>
        <Tabs.Root value={tab} variant="line">
          <Tabs.List px={4} pt={2} borderBottomWidth="1px" borderColor="gray.200">
            <Tabs.Trigger value="promotions" asChild>
              <a href="/monetization?tab=promotions">Promotions</a>
            </Tabs.Trigger>
            <Tabs.Trigger value="pricing" asChild>
              <a href="/monetization?tab=pricing">Pricing</a>
            </Tabs.Trigger>
            <Tabs.Trigger value="vip" asChild>
              <a href="/monetization?tab=vip">VIP Levels</a>
            </Tabs.Trigger>
            <Tabs.Trigger value="exp" asChild>
              <a href="/monetization?tab=exp">EXP & Titles</a>
            </Tabs.Trigger>
            <Tabs.Trigger value="ads" asChild>
              <a href="/monetization?tab=ads">Ads</a>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="promotions" p={4}>
            <PromotionsTab />
          </Tabs.Content>
          <Tabs.Content value="pricing" p={4}>
            <PricingTab />
          </Tabs.Content>
          <Tabs.Content value="vip" p={4}>
            <VipLevelsTab />
          </Tabs.Content>
          <Tabs.Content value="exp" p={4}>
            <ExpTitlesTab />
          </Tabs.Content>
          <Tabs.Content value="ads" p={4}>
            <AdsTab />
          </Tabs.Content>
        </Tabs.Root>
      </Card.Body>
    </Card.Root>
  )
}
