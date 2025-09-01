// src/ui/hsr/components/TrustSafetyPanel.tsx
/**
 * Trust & Safety Panel - Human Authority UI
 * ユーザーの安心感と制御感を最優先にしたUIコンポーネント
 */

import React, { useState, _useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { HSRBrandedStyle } from "../../../services/hsr-system/themes/branded-style.js";

interface TrustSafetyPanelProps {
  processName: string;
  isActive: boolean;
  canInterrupt: boolean;
  hasBackup: boolean;
  progress?: number;
  onEmergencyStop: () => void;
  onNaturalLanguageInput: (_input: string) => void;
}

export const TrustSafetyPanel: React.FC<TrustSafetyPanelProps> = ({
  processName,
  isActive,
  canInterrupt,
  hasBackup,
  progress = 0,
  onEmergencyStop,
  onNaturalLanguageInput,
}) => {
  const [userInput, setUserInput] = useState("");
  const [isListening, _setIsListening] = useState(true);
  const _style = new HSRBrandedStyle();

  // ESCキー監視
  useInput(
    (input, key) => {
      if (key.escape) {
        onEmergencyStop();
      }

      // 自然言語入力の処理
      if (key.return && userInput.trim()) {
        onNaturalLanguageInput(userInput.trim());
        setUserInput("");
      } else if (!key.escape && !key.return && !key.ctrl) {
        setUserInput((prev) => prev + input);
      }
    },
    { isActive: isListening },
  );

  const _safetyStatus = canInterrupt ? "PROTECTED" : "LIMITED";
  const _safetyColor = canInterrupt ? style.ok : style.warn;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      padding={1}
    >
      {/* ヘッダー */}
      <Box marginBottom={1}>
        <Text>{style.brand(" 🛡️ HUMAN SAFETY CONTROL ")}</Text>
        <Text>{style.muted(" │ ")}</Text>
        <Text>{style.heading(processName)}</Text>
      </Box>

      {/* メイン安全表示 */}
      <Box flexDirection="column" marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Safety Status")}: {_safetyColor(_safetyStatus)}
        </Text>

        {/* 緊急停止コントロール */}
        <Box marginTop={1}>
          <Text>{style.ok("🛑 Emergency Stop")}: </Text>
          <Text>
            {canInterrupt
              ? style.ok("ALWAYS AVAILABLE - Press [ESC]")
              : style.warn("LIMITED - Process finishing")}
          </Text>
        </Box>

        {/* 自然言語制御 */}
        <Box marginTop={1}>
          <Text>{style.ok("💬 Natural Control")}: </Text>
          <Text>{style.ok('Say "待って", "止めて", "説明して"')}</Text>
        </Box>

        {/* プロセス可視性 */}
        <Box marginTop={1}>
          <Text>{style.ok("👁️ Full Transparency")}: </Text>
          <Text>
            {isActive
              ? style.ok("Process visible & controllable")
              : style.muted("No active processes")}
          </Text>
        </Box>

        {/* バックアップ状態 */}
        <Box marginTop={1}>
          <Text>{style.ok("🔄 Reversible")}: </Text>
          <Text>
            {hasBackup
              ? style.ok("Backup available - Can rollback")
              : style.muted("No backup - Proceed with caution")}
          </Text>
        </Box>
      </Box>

      {/* プログレス表示(アクティブ時のみ) */}
      {isActive && (
        <Box marginBottom={1}>
          <Text>
            {style.accent("━━ ")}
            {style.heading("Process Progress")}
          </Text>
          <Box marginTop={1}>
            <Text>
              {style.progress(progress)} {style.ok(progress + "%")}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text>{style.muted("Press [ESC] anytime to stop")}</Text>
          </Box>
        </Box>
      )}

      {/* 人間権限の強調 */}
      <Box marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("🏛️ Human Authority")}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          <Text>
            {style.ok("✋ You are in control")}: AI cannot override your
            decisions
          </Text>
          <Text>
            {style.ok("🎯 Final say")}: All AI suggestions require your approval
          </Text>
          <Text>
            {style.ok("🛟 Safe to experiment")}: You can always stop or undo
          </Text>
        </Box>
      </Box>

      {/* 入力エリア */}
      <Box marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Natural Language Input")}
        </Text>
        <Box marginTop={1}>
          <Text>{style.muted("> ")}</Text>
          <Text>{userInput}</Text>
          <Text>{style.muted("_")}</Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            {style.hint(
              'Type naturally: "何してる？", "待って", "止めて", "やり直し"',
            )}
          </Text>
        </Box>
      </Box>

      {/* クイックアクション */}
      <Box>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Quick Actions")}
        </Text>
        <Box marginTop={1}>
          <Text>
            {style.muted("[ESC]")}Emergency Stop {style.muted("[H]")}elp{" "}
            {style.muted("[S]")}tatus {style.muted("[Q]")}uit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Emergency Stop Confirmation Dialog
 * 緊急停止時の確認ダイアログ
 */
interface EmergencyStopDialogProps {
  processName: string;
  progress: number;
  hasPartialResults: boolean;
  onConfirm: (_action: "immediate" | "safe" | "complete" | "cancel") => void;
}

export const EmergencyStopDialog: React.FC<EmergencyStopDialogProps> = ({
  processName,
  progress,
  hasPartialResults,
  onConfirm,
}) => {
  const [selectedOption, setSelectedOption] = useState(0);
  const _style = new HSRBrandedStyle();

  const _options = [
    {
      key: "immediate",
      label: "即座停止",
      description: "即座に停止(進行状況は失われます)",
      risk: "high",
    },
    {
      key: "safe",
      label: "安全一時停止",
      description: "安全に一時停止(再開可能)",
      risk: "low",
    },
    {
      key: "complete",
      label: "完了後停止",
      description: "現在の処理完了後に停止",
      risk: "none",
    },
    {
      key: "cancel",
      label: "継続",
      description: "中断せずに処理を続行",
      risk: "none",
    },
  ];

  useInput((_input, key) => {
    if (key.upArrow && selectedOption > 0) {
      setSelectedOption((prev) => prev - 1);
    } else if (key.downArrow && selectedOption < options.length - 1) {
      setSelectedOption((prev) => prev + 1);
    } else if (key.return) {
      onConfirm(_options[selectedOption].key as any);
    } else if (key.escape) {
      onConfirm("cancel");
    }
  });

  const _getRiskColor = (_risk: string) => {
    switch (risk) {
      case "high":
        return style.err;
      case "low":
        return style.warn;
      default:
        return style.ok;
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="red"
      padding={1}
    >
      <Box marginBottom={1}>
        <Text>
          {style.err("🛑")} {style.brand(" EMERGENCY STOP ")}
          {style.err("🛑")}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Current Process")}: {processName}
        </Text>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Progress")}: {style.progress(progress)} {progress}%
        </Text>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Partial Results")}:{" "}
          {hasPartialResults ? style.ok("Available") : style.warn("None")}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Safe Stop Options")}:
        </Text>
        {options.map((option, _index) => (
          <Box key={option.key} marginTop={1}>
            <Text>
              {index === selectedOption ? style.selected("> ") : "  "}
              {style.ok(`[${index + 1}]`)} {style.heading(option.label)}
              {" - "}
              {option.description} ({_getRiskColor(option.risk)(option.risk)})
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Recommendation")}:{" "}
        </Text>
        <Text>
          {progress > 80
            ? style.ok("完了後停止 (80%以上完了)")
            : style.warn("安全一時停止推奨")}
        </Text>
      </Box>

      <Box>
        <Text>{style.muted("↑↓ 選択, [Enter] 確定, [ESC] キャンセル")}</Text>
      </Box>
    </Box>
  );
};

/**
 * Process Visibility Dashboard
 * 実行中プロセスの完全な可視化
 */
interface ProcessVisibilityDashboardProps {
  activeProcesses: ActiveProcess[];
  onInterruptProcess: (_processId: string) => void;
  onShowDetails: (_processId: string) => void;
}

interface ActiveProcess {
  id: string;
  name: string;
  status: "running" | "paused" | "completing";
  progress: number;
  startTime: number;
  canInterrupt: boolean;
  description: string;
}

export const ProcessVisibilityDashboard: React.FC<
  ProcessVisibilityDashboardProps
> = ({ activeProcesses, onInterruptProcess, onShowDetails }) => {
  const [selectedProcess, setSelectedProcess] = useState(0);
  const _style = new HSRBrandedStyle();

  useInput((input, key) => {
    if (key.upArrow && selectedProcess > 0) {
      setSelectedProcess((prev) => prev - 1);
    } else if (key.downArrow && selectedProcess < activeProcesses.length - 1) {
      setSelectedProcess((prev) => prev + 1);
    } else if (key.return && activeProcesses.length > 0) {
      onShowDetails(activeProcesses[selectedProcess].id);
    } else if (input === "s" && activeProcesses.length > 0) {
      onInterruptProcess(activeProcesses[selectedProcess].id);
    }
  });

  const _formatElapsed = (startTime: number): string => {
    const _elapsed = Math.floor((Date.now() - startTime) / 1000);
    return `${_elapsed}s`;
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
    >
      <Box marginBottom={1}>
        <Text>
          {style.brand(" HRS ")}
          {style.muted("│")}
          {style.heading("Process Control Dashboard")}{" "}
          {style.hint("[ESC] to interrupt any process")}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Active Operations")}
        </Text>

        {activeProcesses.length === 0 ? (
          <Box marginTop={1}>
            <Text>{style.muted("  ○ No active processes")}</Text>
          </Box>
        ) : (
          activeProcesses.map((process, _index) => (
            <Box key={process.id} marginTop={1}>
              <Text>
                {index === selectedProcess ? style.selected("> ") : "  "}
                {process.status === "running"
                  ? style.ok("●")
                  : process.status === "paused"
                    ? style.warn("⏸")
                    : style.muted("○")}{" "}
                {style.heading(process.name)}
                {" : "}
                {process.description} {style.progress(process.progress)}{" "}
                {_formatElapsed(process.startTime)}{" "}
                {process.canInterrupt
                  ? style.warn("[ESC]Stop")
                  : style.muted("[Finishing]")}
              </Text>
            </Box>
          ))
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Human Control")}
        </Text>
        <Box marginTop={1}>
          <Text>
            {style.ok("Active Interruption")}:{" "}
            {style.heading("Natural Language")} + {style.heading("ESC Key")}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            {style.ok("Process Authority")}: {style.heading("Human Override")}{" "}
            &gt; AI Automation
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            {style.ok("Transparency Level")}: {style.heading("Full Visibility")}{" "}
            - すべてのAI行動を表示
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Quick Actions")}
        </Text>
        <Box marginTop={1}>
          <Text>
            {style.muted("[P]")}ause All {style.muted("[S]")}top Selected{" "}
            {style.muted("[R]")}efresh {style.muted("[E]")}xplain Current{" "}
            {style.muted("[H]")}elp
          </Text>
        </Box>
      </Box>

      <Box>
        <Text>
          {style.accent("━━ ")}
          {style.heading("Safety Status")}: {style.ok("✅ Human in Control")}
        </Text>
        <Box marginTop={1}>
          <Text>{style.muted('Type: "何してる？" or press ESC anytime')}</Text>
        </Box>
      </Box>
    </Box>
  );
};
