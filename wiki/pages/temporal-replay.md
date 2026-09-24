---
id: temporal-replay
title: Replay must not call TypeSafe again
---

# Replay must not call TypeSafe again

Activity results already in Event History are reused, not recomputed. If TypeSafe sat in Workflow code, a RED Capture could come back GREEN on replay and apply.
