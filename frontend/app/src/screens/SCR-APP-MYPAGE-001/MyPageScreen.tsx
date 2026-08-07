import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { logout } from '../../api/authApi'
import { getHomeSummary } from '../../api/homeApi'
import { getCurrentRental } from '../../api/rentalApi'
import { getPendingSettlements } from '../../api/settlementApi'
import { getMe } from '../../api/userApi'
import { Button } from '../../components/common/Button'
import { ConfirmModal } from '../../components/common/ConfirmModal'
import { ErrorBanner } from '../../components/common/ErrorBanner'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { AppHeader } from '../../components/layout/AppHeader'
import { Screen } from '../../components/layout/Screen'
import type { MyPageStackParamList } from '../../navigation/MyPageStackNavigator'
import type { RootStackParamList } from '../../navigation/RootStackNavigator'
import { useAuthStore } from '../../store/useAuthStore'
import { RENTAL_STATUS } from '../../types/rental'

function formatAmount(amount: number) {
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatRentedAt(rentedAt: string) {
  const date = new Date(rentedAt)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours24 = date.getHours()
  const period = hours24 < 12 ? '오전' : '오후'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${period} ${hours12}:${minutes}`
}

function formatRemaining(dueAt: string) {
  const diffMs = new Date(dueAt).getTime() - Date.now()
  if (diffMs <= 0) return '0분'
  const totalMinutes = Math.floor(diffMs / (60 * 1000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}시간 ${minutes}분`
}

function computeProgressPercent(rentedAt: string, dueAt: string) {
  const start = new Date(rentedAt).getTime()
  const end = new Date(dueAt).getTime()
  if (end <= start) return 100
  const percent = ((Date.now() - start) / (end - start)) * 100
  return Math.min(100, Math.max(0, percent))
}

// §9.2(상태 Chip 표시 규칙) — 새 RentalStatus Enum을 만들지 않고 기존 status만 사용한다.
function rentalStatusLabel(status: string) {
  if (status === RENTAL_STATUS.ACTIVE || status === RENTAL_STATUS.RETURNING) return '대여중'
  return status
}

export function MyPageScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MyPageStackParamList>>()
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [extendModalVisible, setExtendModalVisible] = useState(false)
  const [reportModalVisible, setReportModalVisible] = useState(false)

  const userQuery = useQuery({ queryKey: ['mypage-user'], queryFn: getMe })
  const rentalQuery = useQuery({ queryKey: ['mypage-rental'], queryFn: getCurrentRental })
  const settlementQuery = useQuery({
    queryKey: ['mypage-settlements'],
    queryFn: getPendingSettlements,
  })
  // 알림 배지 수만 필요해서 HOME-001을 재사용한다(§2.5 API 매핑엔 없지만, 신규 API·타입을 만들지
  // 않기 위한 선택 — 2026-08-04). 전용 카운트가 필요해지면 ALERT-001 기반으로 다시 정리한다.
  const alertCountQuery = useQuery({ queryKey: ['mypage-alert-count'], queryFn: getHomeSummary })

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: clearAuth,
  })

  if (userQuery.isPending) {
    return <LoadingScreen />
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <Screen>
        <View className="mt-10 gap-4 px-6">
          <ErrorBanner message="내 정보를 불러오지 못했어요" />
          <Button label="다시 시도" onPress={() => userQuery.refetch()} />
        </View>
      </Screen>
    )
  }

  const profile = userQuery.data
  const rental = rentalQuery.data ?? null
  const settlements = settlementQuery.data

  return (
    <Screen edges={['right', 'bottom', 'left']}>
      <AppHeader
        schoolName={profile.schoolName}
        alertCount={alertCountQuery.data?.alertCount ?? 0}
        onPressAlert={() => rootNavigation.navigate('Notification')}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-6 pb-24 pt-6"
        refreshControl={
          <RefreshControl
            refreshing={
              userQuery.isRefetching ||
              rentalQuery.isRefetching ||
              settlementQuery.isRefetching ||
              alertCountQuery.isRefetching
            }
            onRefresh={() => {
              userQuery.refetch()
              rentalQuery.refetch()
              settlementQuery.refetch()
              alertCountQuery.refetch()
            }}
          />
        }
      >
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <Text className="text-lg font-bold text-text">{profile.displayName.slice(0, 1)}</Text>
          </View>
          <View>
            <Text className="text-lg font-bold text-text">{profile.displayName}님</Text>
          </View>
        </View>

        <View className="gap-4 rounded-2xl bg-white p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-text">현재 대여 현황</Text>
            {rental ? (
              <View
                className={`rounded-full px-3 py-1 ${rental.overdueDays > 0 ? 'bg-error-bg' : 'bg-rented-bg'}`}
              >
                <Text
                  className={`text-xs font-bold ${rental.overdueDays > 0 ? 'text-error-text' : 'text-rented-text'}`}
                >
                  {rental.overdueDays > 0 ? '연체중' : rentalStatusLabel(rental.status)}
                </Text>
              </View>
            ) : (
              settlements &&
              settlements.items.length > 0 && (
                <View className="rounded-full bg-purple-100 px-3 py-1">
                  <Text className="text-xs font-bold text-purple-700">미정산</Text>
                </View>
              )
            )}
          </View>

          {rentalQuery.isPending && (
            <Text className="text-sm text-text-secondary">불러오는 중이에요</Text>
          )}
          {rentalQuery.isError && (
            <Text className="text-sm text-text-secondary">대여 정보를 불러오지 못했어요</Text>
          )}

          {!rentalQuery.isPending && !rentalQuery.isError && !rental && (
            <Text className="text-sm text-text-secondary">대여 중인 우산이 없어요</Text>
          )}

          {rental && (
            <>
              <View className="mb-6 flex-row items-center justify-between">
                <Text className="text-base font-medium">
                  {rental.checkoutStation.name}
                </Text>
                <Text className="text-base font-medium text-text-secondary">
                  {formatRentedAt(rental.rentedAt)} 대여
                </Text>
              </View>

              {rental.overdueDays > 0 ? (
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-text-secondary">반납까지 남은 시간</Text>
                    <Text className="text-sm font-bold text-error-text">기한 지남</Text>
                  </View>
                  <View className="h-2 w-full overflow-hidden rounded-full bg-disabled">
                    <View className="h-2 w-full rounded-full bg-error-cta" />
                  </View>
                </View>
              ) : (
                <View className="gap-2">
                  <Text className="text-sm text-text-secondary">반납까지 남은 시간</Text>
                  <View className="h-2 w-full overflow-hidden rounded-full bg-disabled">
                    <View
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${computeProgressPercent(rental.rentedAt, rental.dueAt)}%` }}
                    />
                  </View>
                  <Text className="text-right text-base font-bold text-text-tertiary">
                    {formatRemaining(rental.dueAt)}
                  </Text>
                </View>
              )}

              {/* 연장·신고는 DEFERRED_NOT_CONTRACTED — 확인 모달까지만 Mock, 실제 서버 반영 없음(2026-08-04). */}
              <View className="mt-4 flex-row gap-3">
                <Pressable
                  onPress={() => setExtendModalVisible(true)}
                  className="flex-1 items-center justify-center rounded-2xl border border-disabled px-4 py-3 active:opacity-70"
                >
                  <Text className="text-sm font-bold text-text-tertiary">연장하기</Text>
                </Pressable>
                <Pressable
                  onPress={() => setReportModalVisible(true)}
                  className="flex-1 items-center justify-center rounded-2xl border border-disabled px-4 py-3 active:opacity-70"
                >
                  <Text className="text-sm font-bold text-text-tertiary">신고하기</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {settlementQuery.isError && <ErrorBanner message="미정산 정보를 불러오지 못했어요" />}

        {settlements && settlements.items.length > 0 && (
          <View className="flex-row items-center justify-between rounded-2xl bg-error-bg p-5">
            <View>
              <Text className="text-sm text-text-secondary">미정산 금액</Text>
              <Text className="text-lg font-bold text-error-text">
                {formatAmount(settlements.totalOutstandingAmount)}
              </Text>
            </View>
            {/* PAYMENT-001~003 실제 결제 흐름은 Phase 7에서 연결 — 지금은 자리만 배치. */}
            <Pressable
              onPress={() => {}}
              className="items-center justify-center rounded-2xl bg-error-cta px-5 py-3 active:opacity-80"
            >
              <Text className="text-sm font-bold text-white">결제하기</Text>
            </Pressable>
          </View>
        )}

        <View className="overflow-hidden rounded-2xl bg-white">
          <Pressable
            onPress={() => navigation.navigate('Inquiry')}
            className="border-b border-disabled px-5 py-4 active:opacity-70"
          >
            <Text className="text-base text-text">문의하기</Text>
          </Pressable>
          <Pressable
            onPress={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="px-5 py-4 active:opacity-70"
          >
            <Text className="text-base text-text">로그아웃</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={extendModalVisible}
        title="대여 기간을 연장할까요?"
        description="1회 연장이 가능합니다."
        confirmLabel="연장하기"
        confirmVariant="primary"
        onCancel={() => setExtendModalVisible(false)}
        onConfirm={() => setExtendModalVisible(false)}
      />
      <ConfirmModal
        visible={reportModalVisible}
        title="우산 파손·분실을 신고할까요?"
        description="신고 후 관리자 확인을 거쳐 처리돼요."
        warningText="분실·파손 시 우산가액이 청구될 수 있어요."
        confirmLabel="신고하기"
        confirmVariant="danger"
        onCancel={() => setReportModalVisible(false)}
        onConfirm={() => setReportModalVisible(false)}
      />
    </Screen>
  )
}
