import { useMemo, useState } from 'react';
import KeyboardGuard from '../keyboard-guard/KeyboardGuard.jsx';
import PlaySurface from '../../components/PlaySurface.jsx';
import CompletionScreen from '../../components/CompletionScreen.jsx';
import TipyButton from '../../components/TipyButton.jsx';
import { replayGuardAssessment, guardAssessmentResult } from '../keyboard-guard/assessment.js';

export default function GuardAssessmentPreview({ section, onBack }) {
  const [result, setResult] = useState(null);
  const adapter = useMemo(
    () => ({
      section,
      attemptId: 'teacher-preview',
      onChange(value) {
        if (value.done)
          setResult(
            guardAssessmentResult(
              section,
              replayGuardAssessment(section, 'teacher-preview', value),
            ),
          );
      },
    }),
    [section],
  );
  return (
    <PlaySurface>
      <div className="assessment-guard-preview">
        <header>
          <TipyButton variant="back" onClick={onBack}>
            Đóng xem thử
          </TipyButton>
          <span>Xem thử · Không lưu kết quả hoặc trừ lượt</span>
        </header>
        {result ? (
          <CompletionScreen
            good={result.outcome === 'good'}
            scores={[[`${result.score} điểm`, section.title]]}
            onBack={onBack}
          />
        ) : (
          <KeyboardGuard assessment={adapter} onBack={onBack} />
        )}
      </div>
    </PlaySurface>
  );
}
