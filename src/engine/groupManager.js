/**
 * groupManager.js
 *
 * Manages physical piece-joining / grouping logic for PuzzleCanvas.
 *
 * CORE PRINCIPLES:
 * 1. Groups are relative assemblies: pieces attach to each other where the player
 *    assembles them, NOT snapped to final puzzle coordinates.
 * 2. Dragging any piece in a group moves the entire group as a rigid unit.
 * 3. Two pieces attach only if:
 *    - They are actual puzzle neighbors (top, bottom, left, right in solved grid).
 *    - Their shared edges are correctly aligned (same rotation).
 *    - Their relative displacement is within ATTACH_DISTANCE tolerance.
 * 4. Merging keeps the stationary group stable and shifts the moved group only
 *    enough to achieve zero-gap alignment.
 * 5. Supports piece↔piece, piece↔group, and group↔group multi-piece merging.
 */

// Tolerance in px for relative alignment attachment
export const ATTACH_DISTANCE = 32;

// Proximity distance for subtle visual feedback hint before attachment
export const PROXIMITY_DISTANCE = 50;

/**
 * Normalize an angle in degrees to [0, 360).
 */
export function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Calculate expected relative vector from pieceA to pieceB in canvas coordinates,
 * taking into account their common rotation.
 *
 * @param {object} pieceA
 * @param {object} pieceB
 * @returns {{ expectedDx: number, expectedDy: number }}
 */
export function calculateExpectedOffset(pieceA, pieceB) {
  // Unrotated vector in puzzle space
  const dx0 = pieceB.correctX - pieceA.correctX;
  const dy0 = pieceB.correctY - pieceA.correctY;

  const rot = normalizeAngle(pieceA.currentRotation);
  const rad = (rot * Math.PI) / 180;

  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Standard 2D rotation of vector
  const expectedDx = dx0 * cos - dy0 * sin;
  const expectedDy = dx0 * sin + dy0 * cos;

  return { expectedDx, expectedDy };
}

/**
 * Check if two pieces can attach or are in proximity.
 *
 * @param {object} pieceA - Stationary piece
 * @param {object} pieceB - Candidate moving piece
 * @param {number} attachDistance
 * @returns {object|null}
 */
export function checkPieceAttachment(pieceA, pieceB, attachDistance = ATTACH_DISTANCE) {
  // 1. Must be distinct pieces and distinct groups
  if (pieceA.id === pieceB.id) return null;
  if (pieceA.groupId === pieceB.groupId) return null;

  // 2. Must be actual neighbors in the solved grid
  const isNeighbor =
    pieceA.neighbors &&
    (pieceA.neighbors.top === pieceB.id ||
     pieceA.neighbors.bottom === pieceB.id ||
     pieceA.neighbors.left === pieceB.id ||
     pieceA.neighbors.right === pieceB.id);

  if (!isNeighbor) return null;

  // 3. Must have identical rotation
  if (normalizeAngle(pieceA.currentRotation) !== normalizeAngle(pieceB.currentRotation)) {
    return null;
  }

  // 4. Calculate relative displacement error
  const { expectedDx, expectedDy } = calculateExpectedOffset(pieceA, pieceB);
  const actualDx = pieceB.currentX - pieceA.currentX;
  const actualDy = pieceB.currentY - pieceA.currentY;

  const errX = actualDx - expectedDx;
  const errY = actualDy - expectedDy;
  const distance = Math.hypot(errX, errY);

  if (distance <= attachDistance) {
    return {
      canAttach: true,
      distance,
      // Shift required on pieceB to make its shared edge perfectly align with pieceA
      shiftForB: { x: -errX, y: -errY },
      pieceA,
      pieceB,
    };
  }

  if (distance <= PROXIMITY_DISTANCE) {
    return {
      canAttach: false,
      isProximity: true,
      distance,
      pieceA,
      pieceB,
    };
  }

  return null;
}

/**
 * Find any proximity candidate for pieces in activeGroupId against all other pieces.
 * Used for subtle visual magnetic / glow hints during dragging.
 *
 * @param {string} activeGroupId
 * @param {object[]} pieces
 * @returns {object|null}
 */
export function findProximityHint(activeGroupId, pieces) {
  const activePieces = pieces.filter((p) => p.groupId === activeGroupId);
  const otherPieces = pieces.filter((p) => p.groupId !== activeGroupId);

  let bestMatch = null;
  let minDistance = Infinity;

  for (const a of otherPieces) {
    for (const b of activePieces) {
      const result = checkPieceAttachment(a, b);
      if (result && result.distance < minDistance) {
        minDistance = result.distance;
        bestMatch = result;
      }
    }
  }

  return bestMatch;
}

/**
 * Resolves all attachments for a moved group against all other groups on the canvas.
 * Iteratively connects any touching neighbor groups until no more attachments are found.
 *
 * @param {string} activeGroupId - The groupId that was just dropped / moved
 * @param {object[]} pieces - Current state of all pieces
 * @param {number} attachDistance
 * @returns {{ pieces: object[], attached: boolean, mergedPieceIds: number[] }}
 */
export function resolveAllAttachments(activeGroupId, pieces, attachDistance = ATTACH_DISTANCE) {
  let currentPieces = pieces.map((p) => ({ ...p }));
  let currentGroupId = activeGroupId;
  let hasAttached = false;
  const mergedPieceIds = new Set();

  let maxIterations = 24; // safety guard
  while (maxIterations-- > 0) {
    const activePieces = currentPieces.filter((p) => p.groupId === currentGroupId);
    const otherPieces = currentPieces.filter((p) => p.groupId !== currentGroupId);

    let bestAttachment = null;
    let minDistance = Infinity;

    // Find closest valid attachment between active group and any other group
    for (const stationaryPiece of otherPieces) {
      for (const movingPiece of activePieces) {
        const result = checkPieceAttachment(stationaryPiece, movingPiece, attachDistance);
        if (result && result.canAttach && result.distance < minDistance) {
          minDistance = result.distance;
          bestAttachment = result;
        }
      }
    }

    if (!bestAttachment) {
      break; // No more attachments found
    }

    // Apply relative alignment: shift ALL pieces in active group by shiftForB
    const { shiftForB, pieceA } = bestAttachment;
    const targetGroupId = pieceA.groupId;

    currentPieces = currentPieces.map((p) => {
      if (p.groupId === currentGroupId) {
        mergedPieceIds.add(p.id);
        return {
          ...p,
          currentX: p.currentX + shiftForB.x,
          currentY: p.currentY + shiftForB.y,
          groupId: targetGroupId,
        };
      }
      if (p.groupId === targetGroupId) {
        mergedPieceIds.add(p.id);
      }
      return p;
    });

    currentGroupId = targetGroupId;
    hasAttached = true;
  }

  return {
    pieces: currentPieces,
    attached: hasAttached,
    newGroupId: currentGroupId,
    mergedPieceIds: Array.from(mergedPieceIds),
  };
}

/**
 * Rotate an entire group around its center of mass.
 *
 * @param {string} groupId
 * @param {number} deltaDegrees - typically +90 (clockwise) or -90 (counter-clockwise)
 * @param {object[]} pieces
 * @returns {object[]}
 */
export function rotateGroup(groupId, deltaDegrees, pieces) {
  const groupPieces = pieces.filter((p) => p.groupId === groupId);
  if (groupPieces.length === 0) return pieces;

  // Calculate center of mass of the group
  const count = groupPieces.length;
  const centerX = groupPieces.reduce((sum, p) => sum + p.currentX, 0) / count;
  const centerY = groupPieces.reduce((sum, p) => sum + p.currentY, 0) / count;

  const rad = (deltaDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return pieces.map((p) => {
    if (p.groupId !== groupId) return p;

    const relX = p.currentX - centerX;
    const relY = p.currentY - centerY;

    const newX = centerX + (relX * cos - relY * sin);
    const newY = centerY + (relX * sin + relY * cos);
    const newRotation = normalizeAngle(p.currentRotation + deltaDegrees);

    return {
      ...p,
      currentX: Math.round(newX * 100) / 100,
      currentY: Math.round(newY * 100) / 100,
      currentRotation: newRotation,
    };
  });
}

/**
 * Move an entire group by (deltaX, deltaY) relative to drag start snapshot.
 *
 * @param {string} groupId
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {Array<{ id: number, startX: number, startY: number }>} initialPositions
 * @param {object[]} pieces
 * @returns {object[]}
 */
export function moveGroup(groupId, deltaX, deltaY, initialPositions, pieces) {
  const posMap = new Map(initialPositions.map((item) => [item.id, item]));

  return pieces.map((p) => {
    if (p.groupId !== groupId) return p;
    const init = posMap.get(p.id);
    if (!init) return p;
    return {
      ...p,
      currentX: init.startX + deltaX,
      currentY: init.startY + deltaY,
    };
  });
}

/**
 * Bring all pieces in a group to front together.
 *
 * @param {string} groupId
 * @param {object[]} pieces
 * @returns {object[]}
 */
export function bringGroupToFront(groupId, pieces) {
  const maxZ = Math.max(...pieces.map((p) => p.zIndex || 0));
  let addedZ = 1;
  return pieces.map((p) => {
    if (p.groupId === groupId) {
      return { ...p, zIndex: maxZ + addedZ++ };
    }
    return p;
  });
}

/**
 * Get summary stats for groups in the puzzle.
 */
export function getGroupSummary(pieces) {
  const groupMap = new Map();
  for (const p of pieces) {
    const list = groupMap.get(p.groupId) || [];
    list.push(p.id);
    groupMap.set(p.groupId, list);
  }

  const groupSizes = Array.from(groupMap.values()).map((list) => list.length);
  const totalGroups = groupMap.size;
  const largestGroupSize = groupSizes.length > 0 ? Math.max(...groupSizes) : 0;

  return {
    totalGroups,
    largestGroupSize,
    allConnected: totalGroups === 1,
  };
}
