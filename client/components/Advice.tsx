import { useState } from 'react';
import { Modal } from './common/Modal.js';

type AdviceProps = {
  coins: number;
  onSpendCoin: () => boolean;
};

const messages = [
  'A quiet inbox is painful, but it is not a reliable measure of your ability or worth.',
  'A rejection can reflect timing, budget, internal candidates, or a crowded field. You may never learn which.',
  'You are allowed to take a day off from applications. Rest is part of staying human through a hard process.',
  'If a role asks for an impossible mix of skills, that mismatch is not a personal failing.',
  'A small, finished task today counts: updating one resume bullet, saving one role, or asking for a pause.',
  'You do not have to turn every conversation into a career opportunity. Connection can simply be connection.',
  'The market can be harsh and opaque. Your struggle with it does not mean you are doing everything wrong.',
  'Try setting a stopping time for job searching today. The search does not get to occupy every hour.',
  'If applying feels overwhelming, choose one next step small enough to do in ten minutes.',
  'You can be disappointed about a rejection and still leave room for a different possibility later.',
  'A gap in employment is a circumstance, not a complete story about your skills or character.',
  'You are allowed to pursue a practical role while still caring about meaningful work.',
  'When energy is low, maintaining your basics—food, water, sleep, a little movement—is real progress.',
  'A job description is an employer’s wish list. It is not a verdict on whether you deserve to apply.',
  'You can ask someone you trust to sit with you while you do one difficult job-search task.',
  'It is reasonable to feel angry or tired about a process that offers so little feedback.',
  'Your worth does not rise and fall with interview invitations. You remain a whole person between applications.',
  'If today brought no replies, today still happened. You can choose to stop and begin again when ready.',
  'You may suggest reaching out to a former colleague or community, if that feels useful and safe for you.',
  'Try writing down what is within your control today, then let the rest be uncertain for now.',
  'An interview is also your chance to learn whether the role and workplace feel right for you.',
  'You do not need to be relentlessly optimistic. A little curiosity or willingness to continue is enough.',
  'If a company disappears after an interview, that says something about their process, not your basic value.',
  'A portfolio, resume, or career path can be imperfect and still communicate real experience.',
  'It is okay to widen or narrow your search based on what you can sustain, not only what sounds ideal.',
  'You can celebrate sending an application without making yourself responsible for the employer’s decision.',
  'The right pace is one you can live with. Someone else’s job-search routine does not have to be yours.',
  'If the search is affecting your mental health, consider talking with someone supportive or a qualified professional.',
  'You deserve respect and basic clarity from employers, even when hiring decisions are outside your control.',
  'You have made it through difficult days before. For this moment, focus only on the next manageable thing.',
  'You can ask for help with a specific task—proofreading, practice, or company research—without asking anyone to fix everything.',
  'A break from job boards is not giving up. It can be how you protect enough energy to return later.',
];

export function Advice({ coins, onSpendCoin }: AdviceProps) {
  const [modal, setModal] = useState<'offer' | 'message'>();
  const [message, setMessage] = useState('');

  function buyAdvice() {
    if (coins < 1 || !onSpendCoin()) return;
    setMessage(messages[Math.floor(Math.random() * messages.length)]);
    setModal('message');
  }

  return (
    <>
      <button
        className="wellbeing-button"
        type="button"
        aria-label="Get job search encouragement for one coin"
        title="Job search encouragement — 1 coin"
        onClick={() => setModal('offer')}
      >
        <span aria-hidden="true">🧠</span><span aria-hidden="true">💚</span>
      </button>

      {modal === 'offer' && (
        <Modal
          title="A little support for the search"
          confirmLabel={coins > 0 ? 'Pay 1 coin' : 'Not enough coins'}
          onConfirm={buyAdvice}
          onCancel={() => setModal(undefined)}
        >
          Pay a coin for some mental health advice or a positive outlook on the job search?
          {coins < 1 && <p>You need at least one coin to get a message.</p>}
        </Modal>
      )}

      {modal === 'message' && (
        <Modal
          title="A thought for you"
          confirmLabel="Another thought (1 coin)"
          onConfirm={() => setModal('offer')}
          onCancel={() => setModal(undefined)}
        >
          {message}
        </Modal>
      )}
    </>
  );
}
