import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { MOTION, springLinear } from '@/design/motion';
import { guardFor, hrefOf, pageAt, resumeAt } from '@/setup/graph';
import { useStore } from '@/store/useStore';
import type { PageId } from '@/types/setup';
import { PageFrame } from './PageFrame';
import { PAGE_VIEWS } from './pages';
import { ReviewPage } from './ReviewPage';
import { useCtx, useSetupAnswers } from './useSetup';
import { WelcomePage } from './WelcomePage';

/**
 * Setup at `/setup/:chapter/:page` (journey §19.2): page 1 at `/setup`,
 * Review at `/setup/review`. Only its own page layer moves between pages
 * (M22): `data-task` on <html> stills the rest, and the spring is set there.
 */
export default function SetupRoutes() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.task = 'setup';
    root.style.setProperty('--setup-ease', springLinear(0));
    root.style.setProperty('--setup-ms', `${MOTION.spring.cssMs}ms`);
    return () => {
      delete root.dataset.task;
      root.style.removeProperty('--setup-ease');
      root.style.removeProperty('--setup-ms');
    };
  }, []);
  return (
    <Routes>
      <Route index element={<Start />} />
      <Route path="review" element={<Guarded id="review" />} />
      <Route path=":chapter/:page" element={<ByAddress />} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}

/**
 * Page 1, or where a draft stopped. Read once, on arrival: reopening resumes
 * on the draft's page with "Welcome back" (§6.1); Back to page 1 stays here.
 */
function Start() {
  const location = useLocation();
  const { answers, at } = useSetupAnswers();
  const ctx = useCtx();
  const [arrival] = useState(() => ((location.state as { back?: boolean } | null)?.back ? undefined : at));
  if (arrival !== undefined && arrival !== 'welcome.start') {
    return <Navigate to={hrefOf(resumeAt(answers, arrival, ctx))} replace state={{ welcomeBack: true }} />;
  }
  return <WelcomePage />;
}

function ByAddress() {
  const { chapter, page } = useParams();
  const id = pageAt(chapter, page);
  if (!id || id === 'welcome.start' || id === 'review') return <Navigate to="/setup" replace />;
  return <Guarded id={id} />;
}

/** A page opened by its address: on to the page it needs first, or past one that doesn't apply (Review Focus 5). */
function Guarded({ id }: { id: PageId }) {
  const location = useLocation();
  const { answers } = useSetupAnswers();
  const { epoch } = useStore();
  const ctx = useCtx();
  const to = guardFor(answers, id, ctx);
  if (to !== undefined && to !== id) return <Navigate to={hrefOf(to)} replace state={location.state} />;
  if (id === 'review') return <ReviewPage />;
  // A record replaced under the page draws it again from the new one (H5-07).
  return <PageFrame key={`${id}:${epoch}`} id={id} View={PAGE_VIEWS[id as keyof typeof PAGE_VIEWS]} />;
}
