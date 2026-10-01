import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useReducedMotion, MotionValue } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

interface SceneData {
  eyebrow: string;
  title: string;
  description: string;
  pills?: string[];
  ctaText?: string;
  ctaLink?: string;
  isHero?: boolean;
}

const scenes: SceneData[] = [
  {
    isHero: true,
    eyebrow: '01 / YOUR DATA',
    title: 'Bring Your Data to Life',
    description: 'Upload your data and let Infoloom turn it into something you can understand.',
    pills: ['Easy Upload', 'Multiple Formats', 'Automatic Organization'],
    ctaText: 'Start Exploring',
    ctaLink: '/dashboard',
  },
  {
    eyebrow: '02 / CLEAN & READY',
    title: 'Cleaner Data. Better Analysis.',
    description: 'Find missing values, duplicates and unusual data automatically before they affect your results.',
    pills: ['Missing Values', 'Duplicate Detection', 'Automatic Cleaning'],
  },
  {
    eyebrow: '03 / EXPLORE',
    title: 'See What Your Data Is Telling You',
    description: 'Explore patterns, relationships and distributions through clear, interactive visualizations.',
    pills: ['Visual Insights', 'Relationships', 'Distributions'],
    ctaText: 'View Analysis',
    ctaLink: '/eda',
  },
  {
    eyebrow: '04 / INSIGHTS',
    title: 'Turn Data Into Clear Insights',
    description: 'Discover the patterns and signals that matter, without digging through rows of data.',
    pills: ['Key Patterns', 'Important Features', 'Actionable Insights'],
  },
  {
    eyebrow: '05 / GET STARTED',
    title: 'Your Data Has More to Say',
    description: 'Upload your first dataset and start discovering what is inside.',
    ctaText: 'Start Exploring',
    ctaLink: '/dashboard',
  },
];

interface SceneCardProps {
  scene: SceneData;
  opacity: MotionValue<number>;
  y: MotionValue<number> | number;
  pointerEvents: MotionValue<'none' | 'auto'> | MotionValue<string>;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, opacity, y, pointerEvents }) => {
  return (
    <motion.div
      style={{
        opacity,
        y,
        pointerEvents: pointerEvents as any,
      }}
      className="absolute w-full max-w-xl md:max-w-2xl text-center px-4"
    >
      <div className="rounded-2xl bg-[#090614]/85 border border-white/[0.08] backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center justify-center">
        {/* Prominent Hero Title (Scene 1 only) */}
        {scene.isHero && (
          <h1
            className="font-sergena text-4xl sm:text-6xl md:text-7xl font-bold tracking-wider text-white mb-3 leading-none"
            style={{ fontFamily: "'Sergena', sans-serif" }}
          >
            INFOLOOM
          </h1>
        )}

        {/* Eyebrow */}
        <div className="inline-flex items-center px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300 text-xs font-semibold mb-3">
          {scene.eyebrow}
        </div>

        {/* Title */}
        {scene.isHero ? (
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-purple-100 tracking-tight leading-snug mb-3">
            {scene.title}
          </h2>
        ) : (
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-3">
            {scene.title}
          </h2>
        )}

        {/* Description */}
        <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-lg mx-auto leading-relaxed mb-5">
          {scene.description}
        </p>

        {/* Feature Pills */}
        {scene.pills && scene.pills.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            {scene.pills.map((pill) => (
              <span
                key={pill}
                className="px-3 py-1 rounded-md bg-white/[0.05] border border-white/[0.1] text-xs font-medium text-purple-200"
              >
                {pill}
              </span>
            ))}
          </div>
        )}

        {/* CTA Button */}
        {scene.ctaText && (
          <div className="pt-1">
            <Link to={scene.ctaLink || '/dashboard'}>
              <Button
                variant={scene.isHero || scene.eyebrow.includes('05') ? 'glow' : 'outline'}
                size={scene.eyebrow.includes('05') ? 'lg' : 'default'}
                className="rounded-xl px-6"
              >
                {scene.ctaText}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const ScrollPortal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [canHover, setCanHover] = useState(false);

  // Mouse tilt for desktop only
  const springX = useSpring(0, { stiffness: 45, damping: 20 });
  const springY = useSpring(0, { stiffness: 45, damping: 20 });

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    setCanHover(media.matches);

    const handleMouseMove = (e: MouseEvent) => {
      if (!media.matches || prefersReducedMotion) return;
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 14;
      const y = (e.clientY / innerHeight - 0.5) * -14;
      springX.set(x);
      springY.set(y);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [prefersReducedMotion, springX, springY]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Perspective camera transforms:
  // Scales artwork through 3D perspective scenes
  const artworkScale = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [1.0, 1.3, 1.7, 2.3, 3.1]
  );

  const artworkTranslateZ = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [0, 160, 360, 600, 900]
  );

  // Keep artwork visible but restrained so it never competes with copy
  const artworkOpacity = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [0.55, 0.45, 0.38, 0.28, 0.1]
  );

  const portalGlow = useTransform(
    scrollYProgress,
    [0, 0.3, 0.6, 0.85, 1],
    [
      'drop-shadow(0 0 20px rgba(168, 85, 247, 0.25))',
      'drop-shadow(0 0 35px rgba(168, 85, 247, 0.38))',
      'drop-shadow(0 0 50px rgba(147, 51, 234, 0.48))',
      'drop-shadow(0 0 70px rgba(168, 85, 247, 0.55))',
      'drop-shadow(0 0 90px rgba(192, 132, 252, 0.65))',
    ]
  );

  // Scene Opacities & Y offsets across scroll steps
  const scene1Opacity = useTransform(scrollYProgress, [0, 0.14, 0.22], [1, 1, 0]);
  const scene1Y = useTransform(scrollYProgress, [0, 0.2], [0, -30]);
  const scene1Pointer = useTransform(scene1Opacity, (v) => (v > 0.1 ? 'auto' : 'none'));

  const scene2Opacity = useTransform(scrollYProgress, [0.2, 0.28, 0.38, 0.44], [0, 1, 1, 0]);
  const scene2Y = useTransform(scrollYProgress, [0.2, 0.28, 0.44], [30, 0, -30]);
  const scene2Pointer = useTransform(scene2Opacity, (v) => (v > 0.1 ? 'auto' : 'none'));

  const scene3Opacity = useTransform(scrollYProgress, [0.42, 0.50, 0.62, 0.68], [0, 1, 1, 0]);
  const scene3Y = useTransform(scrollYProgress, [0.42, 0.50, 0.68], [30, 0, -30]);
  const scene3Pointer = useTransform(scene3Opacity, (v) => (v > 0.1 ? 'auto' : 'none'));

  const scene4Opacity = useTransform(scrollYProgress, [0.66, 0.74, 0.84, 0.90], [0, 1, 1, 0]);
  const scene4Y = useTransform(scrollYProgress, [0.66, 0.74, 0.90], [30, 0, -30]);
  const scene4Pointer = useTransform(scene4Opacity, (v) => (v > 0.1 ? 'auto' : 'none'));

  const scene5Opacity = useTransform(scrollYProgress, [0.88, 0.95, 1], [0, 1, 1]);
  const scene5Y = useTransform(scrollYProgress, [0.88, 0.95], [30, 0]);
  const scene5Pointer = useTransform(scene5Opacity, (v) => (v > 0.1 ? 'auto' : 'none'));

  const sceneMotions = [
    { opacity: scene1Opacity, y: prefersReducedMotion ? 0 : scene1Y, pointer: scene1Pointer },
    { opacity: scene2Opacity, y: prefersReducedMotion ? 0 : scene2Y, pointer: scene2Pointer },
    { opacity: scene3Opacity, y: prefersReducedMotion ? 0 : scene3Y, pointer: scene3Pointer },
    { opacity: scene4Opacity, y: prefersReducedMotion ? 0 : scene4Y, pointer: scene4Pointer },
    { opacity: scene5Opacity, y: prefersReducedMotion ? 0 : scene5Y, pointer: scene5Pointer },
  ];

  return (
    <div ref={containerRef} className="relative h-[550vh] bg-[#05030a] text-white">
      {/* Sticky Viewport Acting as 3D Camera Frustum */}
      <div
        className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-between"
        style={{ perspective: '1100px' }}
      >
        {/* Subtle ambient backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f133815_1px,transparent_1px),linear-gradient(to_bottom,#1f133815_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-purple-700/12 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-100px] left-1/2 -translate-x-1/2 w-[850px] h-[380px] bg-violet-900/10 rounded-full blur-[160px] pointer-events-none" />

        {/* Top Navigation: INFOLOOM | Explore EDA | Enter Platform */}
        <header className="relative z-30 flex items-center justify-between px-6 sm:px-8 py-5 w-full max-w-7xl mx-auto">
          <Link to="/" className="flex items-center">
            <span
              className="font-sergena text-2xl sm:text-3xl tracking-wider text-white hover:text-purple-300 transition-colors"
              style={{ fontFamily: "'Sergena', sans-serif" }}
            >
              INFOLOOM
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/eda">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white text-xs sm:text-sm">
                Explore EDA
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="glow" size="sm" className="text-xs sm:text-sm">
                Enter Platform
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Central 3D Visual Subject (Hero Artwork Portal) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <motion.div
            style={{
              scale: prefersReducedMotion ? 1 : artworkScale,
              z: prefersReducedMotion ? 0 : artworkTranslateZ,
              opacity: prefersReducedMotion ? 0.45 : artworkOpacity,
              filter: prefersReducedMotion ? 'none' : portalGlow,
              rotateX: canHover && !prefersReducedMotion ? springY : 0,
              rotateY: canHover && !prefersReducedMotion ? springX : 0,
              transformStyle: 'preserve-3d',
            }}
            className="relative will-change-transform max-w-[580px] max-h-[580px] w-full px-6 flex items-center justify-center"
          >
            {/* Ambient concentric portal rings */}
            <div className="absolute w-[420px] h-[420px] rounded-full border border-purple-500/15 animate-pulse-slow pointer-events-none" />
            <div className="absolute w-[540px] h-[540px] rounded-full border border-violet-600/10 pointer-events-none" />

            <img
              src="/assets/Infoloom-hero.png"
              alt="InfoLoom Core AI Data Engine Artwork"
              className="w-full h-auto object-contain rounded-2xl drop-shadow-[0_15px_40px_rgba(0,0,0,0.85)]"
              loading="eager"
            />
          </motion.div>
        </div>

        {/* Dark radial scrim between artwork and text to eliminate visual competition */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
          <div className="w-[90vw] max-w-2xl h-[55vh] max-h-[460px] rounded-full bg-[#05030a]/80 blur-[70px]" />
        </div>

        {/* Perspective Text / Content Scenes */}
        <div className="relative z-20 flex-1 flex items-center justify-center px-4 sm:px-6 pointer-events-none">
          {scenes.map((scene, idx) => (
            <SceneCard
              key={scene.eyebrow}
              scene={scene}
              opacity={sceneMotions[idx].opacity}
              y={sceneMotions[idx].y}
              pointerEvents={sceneMotions[idx].pointer}
            />
          ))}
        </div>

        {/* Bottom Minimalist Telemetry & Scroll Progress Indicator */}
        <footer className="relative z-30 pb-6 px-6 sm:px-8 flex items-center justify-between text-xs text-slate-500 max-w-7xl w-full mx-auto">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span className="text-slate-400 font-medium">InfoLoom Data Intelligence</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-[11px] hidden sm:inline">Scroll to explore</span>
            <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                style={{ scaleX: scrollYProgress, transformOrigin: 'left' }}
                className="h-full bg-gradient-to-r from-purple-500 to-violet-400"
              />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
