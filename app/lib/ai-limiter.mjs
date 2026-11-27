// Per authenticated user, per process. Hosting still needs a shared limit for multiple instances.
export function createAiLimiter({limit=60, windowMs=60_000, maxUsers=10_000, now=Date.now}={}) {
  const users=new Map();
  return userId => {
    const time=now();
    let state=users.get(userId);
    if (state && time >= state.resetAt) {users.delete(userId); state=undefined;}
    if (!state) {
      if (users.size >= maxUsers) {
        for (const [key,value] of users) if (time >= value.resetAt) users.delete(key);
        if (users.size >= maxUsers) return false;
      }
      state={count:0,resetAt:time+windowMs};users.set(userId,state);
    }
    if (state.count >= limit) return false;
    state.count++;return true;
  };
}

