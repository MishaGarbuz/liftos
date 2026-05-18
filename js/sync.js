/* LiftOS — cloud sync queue + status */
(function (global) {
  const SYNC_QUEUE_KEY = 'liftos_sync_queue_v1';
  let syncQueue = [];
  let hasPendingWrites = false;

  function loadSyncQueue() {
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      syncQueue = raw ? JSON.parse(raw) : [];
    } catch {
      syncQueue = [];
    }
    hasPendingWrites = syncQueue.length > 0;
  }

  function persistSyncQueue() {
    hasPendingWrites = syncQueue.length > 0;
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
    } catch (e) {
      console.warn('sync queue save failed', e);
    }
    updateSyncStatusLabel();
  }

  function enqueueSync(op) {
    syncQueue.push({ ...op, ts: Date.now() });
    persistSyncQueue();
  }

  function updateSyncStatusLabel() {
    if (!global.apiOnline) return;
    const lbl = document.getElementById('syncLabel');
    if (!lbl) return;
    if (hasPendingWrites) {
      lbl.textContent = 'Sync pending';
      document.getElementById('syncStatus')?.classList.add('pending');
    }
  }

  global.setSyncStatus = function (mode, label) {
    const el = document.getElementById('syncStatus');
    const lbl = document.getElementById('syncLabel');
    if (!el || !lbl) return;
    el.className = 'sync-status ' + mode;
    if (mode === 'connected' && hasPendingWrites) {
      el.classList.add('pending');
      lbl.textContent = label === 'Synced' ? 'Synced · pending' : label;
    } else {
      el.classList.remove('pending');
      lbl.textContent = label;
    }
    const detail = document.getElementById('syncDetail');
    if (detail) {
      if (mode === 'connected' && !hasPendingWrites) {
        detail.textContent = 'Workouts saved to your cloud account';
      } else if (mode === 'connected' && hasPendingWrites) {
        detail.textContent = 'Some changes waiting to upload — will retry automatically';
      } else if (mode === 'local') {
        detail.textContent = 'Using this device only — sign in and connect to sync';
      } else if (mode === 'syncing') {
        detail.textContent = 'Talking to AWS…';
      } else {
        detail.textContent = 'Could not reach the API — changes saved on this device';
      }
    }
  };

  global.flushSyncQueue = async function () {
    if (!global.apiOnline || !syncQueue.length) return;
    loadSyncQueue();
    const remaining = [];
    for (const op of syncQueue) {
      try {
        if (op.type === 'set' && typeof global._syncSetOp === 'function') {
          await global._syncSetOp(op.payload);
        } else if (op.type === 'session' && typeof global._syncSessionOp === 'function') {
          await global._syncSessionOp(op.payload, op.completed);
        } else if (op.type === 'delete' && typeof global._syncDeleteOp === 'function') {
          await global._syncDeleteOp(op.payload);
        }
      } catch (e) {
        console.warn('sync queue item failed', op, e);
        remaining.push(op);
        break;
      }
    }
    syncQueue = remaining;
    persistSyncQueue();
    if (!syncQueue.length && global.apiOnline) {
      global.setSyncStatus('connected', 'Synced');
    }
  };

  global.enqueueSync = enqueueSync;
  global.loadSyncQueue = loadSyncQueue;
  loadSyncQueue();
})(window);
