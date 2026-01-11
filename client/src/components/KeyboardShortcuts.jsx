import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTimer } from '../context/TimerContext';

export default function KeyboardShortcuts() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        isRunning,
        timerState,
        task,
        pauseTimer,
        resumeTimer,
        clearTimer
    } = useTimer();

    useEffect(() => {
        function handleKeyDown(event) {
            // Don't trigger shortcuts when typing in inputs
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // Space: Pause/Resume timer
            if (event.code === 'Space' && (timerState || task)) {
                event.preventDefault();
                if (isRunning) {
                    pauseTimer();
                } else {
                    resumeTimer();
                }
            }

            // N: Focus on quick add (new task)
            if (event.code === 'KeyN' && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                const quickAddInput = document.querySelector('.quick-add-input');
                if (quickAddInput) {
                    quickAddInput.focus();
                }
            }

            // T: Go to Timer
            if (event.code === 'KeyT' && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                navigate('/timer');
            }

            // C: Go to Calendar
            if (event.code === 'KeyC' && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                navigate('/tasks');
            }

            // Escape: Clear timer or close modals
            if (event.code === 'Escape') {
                // Check if modal is open
                const modal = document.querySelector('.modal-overlay');
                if (modal) {
                    modal.click(); // Close modal
                }
            }

            // ?: Show shortcuts help
            if (event.code === 'Slash' && event.shiftKey) {
                event.preventDefault();
                showShortcutsHelp();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRunning, timerState, task, pauseTimer, resumeTimer, navigate]);

    function showShortcutsHelp() {
        const existing = document.querySelector('.shortcuts-modal');
        if (existing) {
            existing.remove();
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'shortcuts-modal';
        modal.innerHTML = `
      <div class="shortcuts-content">
        <h3>⌨️ Keyboard Shortcuts</h3>
        <div class="shortcuts-list">
          <div class="shortcut-item"><kbd>Space</kbd> Pause/Resume timer</div>
          <div class="shortcut-item"><kbd>N</kbd> New task (quick add)</div>
          <div class="shortcut-item"><kbd>T</kbd> Go to Timer</div>
          <div class="shortcut-item"><kbd>C</kbd> Go to Calendar</div>
          <div class="shortcut-item"><kbd>Esc</kbd> Close modal</div>
          <div class="shortcut-item"><kbd>?</kbd> Show/hide shortcuts</div>
        </div>
        <p class="shortcuts-dismiss">Press any key to dismiss</p>
      </div>
    `;

        modal.addEventListener('click', () => modal.remove());
        document.addEventListener('keydown', () => modal.remove(), { once: true });
        document.body.appendChild(modal);
    }

    return null; // This component doesn't render anything
}
