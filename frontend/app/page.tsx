import AudioRecorder from "@/components/AudioRecorder";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Verbact &nbsp;
          <code className="font-mono font-bold">Alpha</code>
        </p>
      </div>

      <div className="mt-12 w-full max-w-2xl">
        <AudioRecorder />
      </div>

      <div className="mt-16 text-center text-gray-400 text-sm">
        <p>Powered by Groq & Whisper V3</p>
      </div>
    </main>
  );
}
