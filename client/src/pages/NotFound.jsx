import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 px-6 text-center">
      <p className="text-6xl">🧭</p>
      <h1 className="text-3xl font-bold text-ink-900">Page not found</h1>
      <p className="max-w-md text-ink-500">
        The page you are looking for does not exist. If you followed a link inside the app, please report it — otherwise head back to the
        dashboard.
      </p>
      <Link to="/" className="btn-primary">
        <Home size={17} /> Back to home
      </Link>
    </div>
  );
}
