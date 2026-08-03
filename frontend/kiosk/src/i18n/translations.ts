import type { Language } from '../store/languageStore'
import type { RentalBlockReason } from '../types/eligibility'

// 화면에 렌더링되는 모든 정적 한글 문구를 언어별로 관리한다.
// 화면 추가 시 여기에 키만 추가하면 된다(구조: 화면/도메인 단위로 그룹화).
export interface Translations {
  common: {
    back: string
    home: string
    homeReturn: string
    pleaseWait: string
    slotNumberLabel: string
    checking: string
    notAvailable: string
  }
  header: {
    schoolName: string
    location: string
  }
  stepIndicator: {
    rent: string[]
    return: string[]
  }
  main: {
    rentTitle: string
    rentSubtitle: string
    returnTitle: string
    returnSubtitle: string
    touchHint: string
  }
  auth: {
    guideStep1: string
    guideStep2: string
    guideTitleRent: string
    guideTitleReturn: string
    guideSubtitle: string
    readyButton: string
    welcome: (name: string | null) => string
    faceNotDetectedTitle: string
    faceNotDetectedTips: string[]
    retryFaceAuth: string
    faceNotMatchedTitle: string
    faceNotMatchedTips: string[]
    authSuccessText: string
    confirmQuestion: (name: string | null) => string
    confirmSubtitle: string
    confirmYes: (flow: 'RENT' | 'RETURN') => string
    confirmNo: string
  }
  rent: {
    pickupMessage: (slotNumber: number) => string
    failedTitle: string
    preparingTitle: string
    completeTitle: string
    rentedAtLabel: string
    dueAtLabel: string
    autoReturnHome: string
  }
  return: {
    dropoffMessage: (slotNumber: number) => string
    failedTitle: string
    checkingUmbrella: string
    showUmbrella: string
    completeTitle: string
    returnedAtLabel: string
    resultNormal: string
    resultNeedsReview: string
    autoReturnHome: string
    guideSteps: string[]
    guideTitle: string
    guideSubtitle: string
    autoAdvance: string
  }
  deviceErrorTips: {
    checking: string
    contactAdmin: string
  }
  rentalBlock: {
    reasons: Record<RentalBlockReason, { title: string; subtitle: string }>
    autoClose: string
    close: string
  }
}

const ko: Translations = {
  common: {
    back: '이전',
    home: '홈으로',
    homeReturn: '홈으로 돌아가기',
    pleaseWait: '잠시만 기다려주세요',
    slotNumberLabel: '우산함 번호',
    checking: '확인 중',
    notAvailable: '-',
  },
  header: {
    schoolName: '빌리대학교',
    location: '중앙도서관 1층',
  },
  stepIndicator: {
    rent: ['대여 시작', '안면 인식', '우산 받기'],
    return: ['반납 시작', '안면 인식', '우산 파손 인식', '반납 완료'],
  },
  main: {
    rentTitle: '대여',
    rentSubtitle: '학생 인증 후 우산을 대여합니다',
    returnTitle: '반납',
    returnSubtitle: '사용한 우산을 반납합니다',
    touchHint: '화면을 터치하여 메뉴를 선택해주세요',
  },
  auth: {
    guideStep1: '① 얼굴이 가이드 라인 안에 들어오도록 맞춰주세요.',
    guideStep2: '② 정면을 응시해주세요.',
    guideTitleRent: '우산 대여를 위한 안면 인식을 시작합니다.',
    guideTitleReturn: '우산 반납을 위한 안면 인식을 시작합니다.',
    guideSubtitle: '정확한 안면 인식을 위해 아래 안내를 따라주세요.',
    readyButton: '준비되었습니다',
    welcome: (name: string | null) =>
      name ? `환영합니다! ${name}님` : '환영합니다!',
    faceNotDetectedTitle: '안면 인식이 되지 않았습니다',
    faceNotDetectedTips: [
      '화면 가이드 라인에 얼굴을 맞춰주세요.',
      '얼굴을 정면으로 바라봐 주세요.',
      '마스크를 잠시 벗어주세요.',
    ],
    retryFaceAuth: '안면 인식 다시하기',
    faceNotMatchedTitle: '일치하는 학생 정보를 찾을 수 없습니다',
    faceNotMatchedTips: [
      '얼굴은 확인되었지만 연결된 학생 계정이 없습니다.',
      '학생 인증을 완료한 계정인지 확인해주세요.',
      '문제가 계속되면 관리자에게 문의해주세요.',
    ],
    authSuccessText: '인증되었습니다',
    confirmQuestion: (name: string | null) =>
      name ? `${name}님이 맞으신가요?` : '본인이 맞으신가요?',
    confirmSubtitle: '인식된 정보가 본인 정보와 일치하는지 확인해주세요',
    confirmYes: (flow: 'RENT' | 'RETURN') =>
      `예, 우산 ${flow === 'RETURN' ? '반납' : '대여'} 계속하기`,
    confirmNo: '아니요, 안면 인식 다시하기',
  },
  rent: {
    pickupMessage: (slotNumber: number) =>
      `${slotNumber}번 우산함에서 우산을 꺼내주세요`,
    failedTitle: '대여를 완료하지 못했습니다',
    preparingTitle: '대여를 준비하고 있어요',
    completeTitle: '대여 완료!',
    rentedAtLabel: '대여 시각',
    dueAtLabel: '반납 기한',
    autoReturnHome: '5초 후 자동으로 홈 화면으로 돌아갑니다',
  },
  return: {
    dropoffMessage: (slotNumber: number) =>
      `${slotNumber}번 우산함에 우산을 넣어주세요`,
    failedTitle: '반납을 완료하지 못했습니다',
    checkingUmbrella: '우산 상태를 확인하고 있어요',
    showUmbrella: '우산을 카메라에 잘 보이게 들어주세요',
    completeTitle: '반납 완료!',
    returnedAtLabel: '반납 시각',
    resultNormal: '반납이 완료되었습니다.',
    resultNeedsReview: '반납은 완료되었으며 우산 상태는 관리자가 확인합니다.',
    autoReturnHome: '5초 후 자동으로 홈 화면으로 돌아갑니다',
    guideSteps: [
      '① 우산을 끝까지 펼쳐주세요.',
      '② 우산 전체가 화면 안에 들어오도록 맞춰주세요.',
      '③ 우산을 2~3초간 움직이지 말아주세요.',
    ],
    guideTitle: '우산을 펼쳐 카메라에 보여주세요',
    guideSubtitle: '정확한 파손 검사를 위해 아래 안내를 따라주세요.',
    autoAdvance: '5초 후 자동으로 우산 인식 화면으로 이동합니다',
  },
  deviceErrorTips: {
    checking: '우산함 상태를 확인 중입니다.',
    contactAdmin: '문제가 계속되면 관리자에게 문의해주세요.',
  },
  rentalBlock: {
    reasons: {
      UNSETTLED_BLOCKED: {
        title: '미정산 내역이 있어요',
        subtitle: '앱에서 정산 후 다시 이용해주세요.',
      },
      ACTIVE_RENTAL_EXISTS: {
        title: '이미 대여 중인 우산이 있어요',
        subtitle: '현재 대여 중인 건이 있어 신규 대여할 수 없습니다.',
      },
      ACTIVE_RENTAL_NOT_FOUND: {
        title: '반납할 대여 내역이 없어요',
        subtitle: '현재 대여 중인 우산이 없습니다.',
      },
    },
    autoClose: '5초 후 자동으로 닫힙니다',
    close: '닫기',
  },
}

const en: Translations = {
  common: {
    back: 'Back',
    home: 'Home',
    homeReturn: 'Back to Home',
    pleaseWait: 'Please wait a moment',
    slotNumberLabel: 'Slot Number',
    checking: 'Checking...',
    notAvailable: '-',
  },
  header: {
    schoolName: 'Billi University',
    location: 'Central Library, 1F',
  },
  stepIndicator: {
    rent: ['Start Rental', 'Face Scan', 'Get Umbrella'],
    return: ['Start Return', 'Face Scan', 'Damage Check', 'Return Complete'],
  },
  main: {
    rentTitle: 'Rent',
    rentSubtitle: 'Verify your identity to rent an umbrella',
    returnTitle: 'Return',
    returnSubtitle: 'Return an umbrella you rented',
    touchHint: 'Touch the screen to select a menu',
  },
  auth: {
    guideStep1: '① Position your face inside the guide line.',
    guideStep2: '② Look straight ahead.',
    guideTitleRent: 'Starting face scan for umbrella rental.',
    guideTitleReturn: 'Starting face scan for umbrella return.',
    guideSubtitle: 'Follow the guide below for accurate face recognition.',
    readyButton: "I'm Ready",
    welcome: (name: string | null) =>
      name ? `Welcome! ${name}` : 'Welcome!',
    faceNotDetectedTitle: 'Face Not Detected',
    faceNotDetectedTips: [
      'Align your face with the on-screen guide line.',
      'Face the camera directly.',
      'Please remove your mask.',
    ],
    retryFaceAuth: 'Try Face Scan Again',
    faceNotMatchedTitle: 'No Matching Student Found',
    faceNotMatchedTips: [
      'Your face was detected, but no linked student account was found.',
      'Please make sure your student verification is complete.',
      'Contact an administrator if this continues.',
    ],
    authSuccessText: 'Verified',
    confirmQuestion: (name: string | null) =>
      name ? `Is this ${name}?` : 'Is this you?',
    confirmSubtitle: 'Please confirm the recognized information matches you',
    confirmYes: (flow: 'RENT' | 'RETURN') =>
      `Yes, continue with ${flow === 'RETURN' ? 'return' : 'rental'}`,
    confirmNo: 'No, scan again',
  },
  rent: {
    pickupMessage: (slotNumber: number) =>
      `Take the umbrella from slot ${slotNumber}`,
    failedTitle: 'Rental Could Not Be Completed',
    preparingTitle: 'Preparing your rental',
    completeTitle: 'Rental Complete!',
    rentedAtLabel: 'Rented At',
    dueAtLabel: 'Due By',
    autoReturnHome: 'Returning to the home screen in 5 seconds',
  },
  return: {
    dropoffMessage: (slotNumber: number) =>
      `Insert the umbrella into slot ${slotNumber}`,
    failedTitle: 'Return Could Not Be Completed',
    checkingUmbrella: 'Checking umbrella condition',
    showUmbrella: 'Hold the umbrella clearly in front of the camera',
    completeTitle: 'Return Complete!',
    returnedAtLabel: 'Returned At',
    resultNormal: 'Your return is complete.',
    resultNeedsReview:
      'Your return is complete. An admin will review the umbrella condition.',
    autoReturnHome: 'Returning to the home screen in 5 seconds',
    guideSteps: [
      '① Open the umbrella all the way.',
      '② Make sure the whole umbrella fits in the frame.',
      '③ Hold it still for 2–3 seconds.',
    ],
    guideTitle: 'Open the umbrella and show it to the camera',
    guideSubtitle: 'Follow the guide below for an accurate damage check.',
    autoAdvance: 'Moving to the umbrella scan screen in 5 seconds',
  },
  deviceErrorTips: {
    checking: 'Checking the umbrella slot status.',
    contactAdmin: 'Contact an administrator if this continues.',
  },
  rentalBlock: {
    reasons: {
      UNSETTLED_BLOCKED: {
        title: 'You have an unpaid balance',
        subtitle: 'Please settle it in the app, then try again.',
      },
      ACTIVE_RENTAL_EXISTS: {
        title: 'You already have an umbrella rented',
        subtitle: 'You cannot start a new rental while one is active.',
      },
      ACTIVE_RENTAL_NOT_FOUND: {
        title: 'No rental found to return',
        subtitle: "You don't currently have an umbrella rented.",
      },
    },
    autoClose: 'Closing automatically in 5 seconds',
    close: 'Close',
  },
}

export const translations: Record<Language, Translations> = { ko, en }
