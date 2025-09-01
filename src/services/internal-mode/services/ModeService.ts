/**
 * ModeService - Single Source of Truth에 기반한 모드 관리 서비스
 * UI와 분리된 서버측 모드 제어
 */

import {
  MODES,
  MODE_ALIASES,
  type ModeId,
  type ModeSpec,
} from "../config/modes";

let current: ModeSpec =
  MODES[(process.env.MARIA_DEFAULT_MODE as ModeId) || "thinking"];

export const ModeService = {
  /**
   * 현재 모드 반환
   */
  current(): ModeSpec {
    return current;
  },

  /**
   * 모든 모드 반환
   */
  all(): ModeSpec[] {
    return Object.values(MODES);
  },

  /**
   * ID로 모드 설정
   * @param id - canonical id 또는 alias
   * @returns 성공 여부
   */
  setById(id: string): boolean {
    const key = id.toLowerCase() as ModeId;

    // 직접 매치
    if (MODES[key]) {
      current = MODES[key];
      return true;
    }

    // alias 해결
    const hit = MODE_ALIASES[id] || MODE_ALIASES[id.toLowerCase()];
    if (hit && MODES[hit]) {
      current = MODES[hit];
      return true;
    }

    return false;
  },

  /**
   * ID로 모드 스펙 조회
   */
  getById(id: string): ModeSpec | undefined {
    const key = id.toLowerCase() as ModeId;

    // 직접 매치
    if (MODES[key]) {
      return MODES[key];
    }

    // alias 해결
    const hit = MODE_ALIASES[id] || MODE_ALIASES[id.toLowerCase()];
    if (hit && MODES[hit]) {
      return MODES[hit];
    }

    return undefined;
  },

  /**
   * 카테고리별 모드 목록 반환
   */
  getByCategory(category: ModeSpec["category"]): ModeSpec[] {
    return Object.values(MODES).filter((mode) => mode.category === category);
  },

  /**
   * 강도별 모드 목록 반환
   */
  getByIntensity(intensity: ModeSpec["intensity"]): ModeSpec[] {
    return Object.values(MODES).filter((mode) => mode.intensity === intensity);
  },

  /**
   * 현재 모드의 추천 전환 모드들 반환
   */
  getSuggestedTransitions(): ModeSpec[] {
    const transitions = current.transitions || [];
    return transitions.map((id) => MODES[id]).filter(Boolean);
  },

  /**
   * 모드가 유효한지 확인
   */
  isValid(id: string): boolean {
    return this.getById(id) !== undefined;
  },

  /**
   * 디버깅용: 현재 상태 정보
   */
  getDebugInfo() {
    return {
      current: current.id,
      label: current.label,
      category: current.category,
      intensity: current.intensity,
      reasoning: current.reasoning,
      text: current.text,
      toolsCount: current.tools.allowed.length,
      safety: current.safety,
      transitions: current.transitions || [],
    };
  },

  /**
   * 초기화 (테스트용)
   */
  reset(): void {
    current = MODES.thinking;
  },
};

// 타입 안전성을 위한 유틸리티 함수들
export const ModeUtils = {
  /**
   * 모드 ID 목록 반환
   */
  getAllModeIds(): ModeId[] {
    return Object.keys(MODES) as ModeId[];
  },

  /**
   * 별칭 포함한 모든 키 반환
   */
  getAllAliases(): string[] {
    return [...Object.keys(MODES), ...Object.keys(MODE_ALIASES)];
  },

  /**
   * canonical ID로 정규화
   */
  normalizeId(input: string): ModeId | undefined {
    const mode = ModeService.getById(input);
    return mode?.id;
  },

  /**
   * 모드별 통계
   */
  getStats() {
    const modes = Object.values(MODES);
    const categories = [...new Set(modes.map((m) => m.category))];
    const intensities = [...new Set(modes.map((m) => m.intensity))];

    return {
      total: modes.length,
      categories: categories.length,
      intensities: intensities.length,
      byCategory: categories.reduce(
        (acc, cat) => {
          acc[cat] = modes.filter((m) => m.category === cat).length;
          return acc;
        },
        {} as Record<string, number>,
      ),
      byIntensity: intensities.reduce(
        (acc, int) => {
          acc[int] = modes.filter((m) => m.intensity === int).length;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  },
};

export default ModeService;
