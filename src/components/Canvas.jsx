import React, { useRef, useEffect, useState } from 'react';


const Canvas = () => {
    const canvasRef = useRef(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [clusters, setClusters] = useState([]);
    const [frozenClusterIds, setFrozenClusterIds] = useState(new Set());
    const [frozenAssignments, setFrozenAssignments] = useState({}); // clusterId -> number[]
    const isDragging = useRef(false);
    const draggingCoreId = useRef(null);
    const clickStartPos = useRef({ x: 0, y: 0 });
    const lastMousePos = useRef({ x: 0, y: 0 });
    const clickTimeoutRef = useRef(null);
    const rectsRef = useRef([]);
    const polygonRef = useRef([]);
    const currentAssignmentsRef = useRef([]);
    const roadsRef = useRef([
        { p1: { x: -1200, y: 0 }, p2: { x: 1200, y: 0 } },
        { p1: { x: 0, y: -1200 }, p2: { x: 0, y: 1200 } }
    ]);

    const boundaryCoords = [
        [-72.4559521, 42.9074371], [-72.4559513, 42.9075], [-72.4508424, 42.9061169],
        [-72.449855, 42.9063684], [-72.4485241, 42.905834], [-72.4511859, 42.9040422],
        [-72.4515723, 42.9047966], [-72.4554361, 42.9056454], [-72.4568958, 42.9055196],
        [-72.4574539, 42.9039164], [-72.456767, 42.9015902], [-72.4541482, 42.9007414],
        [-72.4512288, 42.900207], [-72.4488247, 42.9002698], [-72.4478802, 42.9009929],
        [-72.4468498, 42.9005213], [-72.4445315, 42.9025647], [-72.4436728, 42.9042937],
        [-72.4398519, 42.9071542], [-72.4381776, 42.9073114], [-72.4374482, 42.9080029],
        [-72.4384352, 42.9085687], [-72.4384352, 42.9089459], [-72.4375336, 42.9089773],
        [-72.4357734, 42.9102346], [-72.4332404, 42.9100775], [-72.4332404, 42.9104861],
        [-72.4319525, 42.9104861], [-72.4298917, 42.9093545], [-72.4285608, 42.9095745],
        [-72.4258561, 42.9091345], [-72.4255556, 42.9097631], [-72.4285179, 42.9104861],
        [-72.4295912, 42.9125291], [-72.4313514, 42.9138178], [-72.4316949, 42.914635],
        [-72.4338415, 42.9148864], [-72.432897, 42.9161436], [-72.436031, 42.9176207],
        [-72.4374482, 42.9186264], [-72.4392509, 42.919915], [-72.4398956, 42.9206692],
        [-72.4405825, 42.921832], [-72.4422139, 42.9227119], [-72.444017, 42.923529],
        [-72.4457343, 42.9217691], [-72.445305, 42.9212977], [-72.4471081, 42.9162064],
        [-72.4487395, 42.9161122], [-72.4497269, 42.9147607], [-72.4520023, 42.9143207],
        [-72.4519165, 42.9138806], [-72.4525604, 42.9127491], [-72.4533761, 42.9123405],
        [-72.4539772, 42.9112404], [-72.454106, 42.9099832], [-72.4559521, 42.9074371]
    ];

    // Helpers
    const isPointInPolygon = (x, y, poly) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const distToSegment = (p, v, w) => {
        const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
        if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt((p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2);
    };

    const doSegmentsIntersect = (p1, p2, p3, p4) => {
        const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
        if (det === 0) return false;
        const uA = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
        const uB = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
        return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
    };

    // Initialize polygon and rectangles
    useEffect(() => {
        const minX = Math.min(...boundaryCoords.map(c => c[0]));
        const maxX = Math.max(...boundaryCoords.map(c => c[0]));
        const minY = Math.min(...boundaryCoords.map(c => c[1]));
        const maxY = Math.max(...boundaryCoords.map(c => c[1]));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const scale = 60000;

        polygonRef.current = boundaryCoords.map(c => ({
            x: (c[0] - centerX) * scale,
            y: (centerY - c[1]) * scale
        }));

        const ASPECT_RATIO = 1 / 7;
        const RECT_WIDTH = 12 / 1.7;
        const RECT_HEIGHT = RECT_WIDTH / ASPECT_RATIO;
        const GAP = 2;
        const ROAD_WIDTH = 25;

        const generateRectangles = () => {
            const newRects = [];
            const bbMinX = Math.min(...polygonRef.current.map(p => p.x));
            const bbMaxX = Math.max(...polygonRef.current.map(p => p.x));
            const bbMinY = Math.min(...polygonRef.current.map(p => p.y));
            const bbMaxY = Math.max(...polygonRef.current.map(p => p.y));

            const STEP_X = RECT_WIDTH + GAP;
            const STEP_Y = RECT_HEIGHT + GAP;

            for (let y = bbMinY; y <= bbMaxY - RECT_HEIGHT; y += STEP_Y) {
                for (let x = bbMinX; x <= bbMaxX - RECT_WIDTH; x += STEP_X) {
                    const newRect = { x, y, width: RECT_WIDTH, height: RECT_HEIGHT };
                    const corners = [
                        { x: newRect.x, y: newRect.y },
                        { x: newRect.x + newRect.width, y: newRect.y },
                        { x: newRect.x + newRect.width, y: newRect.y + newRect.height },
                        { x: newRect.x, y: newRect.y + newRect.height }
                    ];

                    if (corners.every(c => isPointInPolygon(c.x, c.y, polygonRef.current))) {
                        const rectEdges = [
                            [corners[0], corners[1]], [corners[1], corners[2]],
                            [corners[2], corners[3]], [corners[3], corners[0]]
                        ];

                        let hasIntersection = false;
                        for (let i = 0; i < polygonRef.current.length; i++) {
                            const p1 = polygonRef.current[i];
                            const p2 = polygonRef.current[(i + 1) % polygonRef.current.length];
                            for (const rEdge of rectEdges) {
                                if (doSegmentsIntersect(p1, p2, rEdge[0], rEdge[1])) {
                                    hasIntersection = true; break;
                                }
                            }
                            if (hasIntersection) break;
                        }

                        if (hasIntersection) continue;

                        let onRoad = false;
                        for (const road of roadsRef.current) {
                            for (const rEdge of rectEdges) {
                                if (doSegmentsIntersect(road.p1, road.p2, rEdge[0], rEdge[1])) {
                                    onRoad = true; break;
                                }
                            }
                            if (onRoad) break;

                            for (const corner of corners) {
                                if (distToSegment(corner, road.p1, road.p2) < ROAD_WIDTH / 2) {
                                    onRoad = true; break;
                                }
                            }
                            if (onRoad) break;
                        }

                        if (!onRoad) newRects.push(newRect);
                    }
                }
            }
            return newRects;
        };

        rectsRef.current = generateRectangles();
    }, []);

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
            ctx.scale(transform.scale, transform.scale);

            // 1. Draw Roads
            ctx.strokeStyle = 'brown';
            ctx.lineWidth = 25;
            roadsRef.current.forEach(road => {
                ctx.beginPath();
                ctx.moveTo(road.p1.x, road.p1.y);
                ctx.lineTo(road.p2.x, road.p2.y);
                ctx.stroke();
            });

            // 2. Draw Boundary lines
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 5 / transform.scale;
            ctx.beginPath();
            polygonRef.current.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.stroke();

            // 3. Draw Cluster Cores
            clusters.forEach(cluster => {
                ctx.fillStyle = cluster.color;
                ctx.beginPath();
                ctx.arc(cluster.x, cluster.y, 10 / transform.scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = frozenClusterIds.has(cluster.id) ? 'gold' : 'white';
                ctx.lineWidth = 3 / transform.scale;
                ctx.stroke();

                if (frozenClusterIds.has(cluster.id)) {
                    ctx.font = `${10 / transform.scale}px Arial`;
                    ctx.fillStyle = 'gold';
                    ctx.textAlign = 'center';
                    ctx.fillText('🔒', cluster.x, cluster.y - 12 / transform.scale);
                }
            });

            // 4. Draw Rectangles colored by clusters with capacity limit (Global Proximity Sorting)
            const TARGET_CAPACITY = 100;
            const assignments = new Array(rectsRef.current.length).fill(null);
            const clusterOccupancy = {};
            const coreMap = {};

            clusters.forEach(c => {
                clusterOccupancy[c.id] = 0;
                coreMap[c.coreId || c.id] = c;
            });

            // First, apply frozen assignments
            Object.entries(frozenAssignments).forEach(([clusterId, boxIndices]) => {
                const cid = Number(clusterId);
                const representativeCore = clusters.find(c => c.id === cid);
                if (representativeCore) {
                    boxIndices.forEach(idx => {
                        if (idx < assignments.length) {
                            assignments[idx] = representativeCore;
                            clusterOccupancy[cid]++;
                        }
                    });
                }
            });

            if (clusters.length > 0) {
                const allPairs = [];
                rectsRef.current.forEach((rect, boxIdx) => {
                    // Only assign if not already assignments (not frozen)
                    if (assignments[boxIdx] === null) {
                        clusters.forEach(core => {
                            const dx = (rect.x + rect.width / 2) - core.x;
                            const dy = (rect.y + rect.height / 2) - core.y;
                            const distSq = dx * dx + dy * dy;
                            allPairs.push({ boxIdx, coreId: core.coreId || core.id, clusterId: core.id, distSq });
                        });
                    }
                });

                // Sort all possible assignments by distance
                allPairs.sort((a, b) => a.distSq - b.distSq);

                // Assign remaining boxes in order of absolute proximity
                for (const pair of allPairs) {
                    if (assignments[pair.boxIdx] === null && (!clusterOccupancy[pair.clusterId] || clusterOccupancy[pair.clusterId] < TARGET_CAPACITY)) {
                        assignments[pair.boxIdx] = coreMap[pair.coreId];
                        clusterOccupancy[pair.clusterId] = (clusterOccupancy[pair.clusterId] || 0) + 1;
                    }
                }
            }

            currentAssignmentsRef.current = assignments;

            rectsRef.current.forEach((rect, i) => {
                const assignedCore = assignments[i];

                if (assignedCore) {
                    ctx.fillStyle = assignedCore.color;
                    ctx.globalAlpha = 0.3;
                    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
                    ctx.globalAlpha = 1.0;
                    ctx.strokeStyle = assignedCore.color;
                } else {
                    ctx.strokeStyle = 'black';
                }

                ctx.lineWidth = 1.5 / transform.scale;
                ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            });
        };

        const handleResize = () => {
            const { clientWidth, clientHeight } = canvas.parentElement;
            canvas.width = clientWidth;
            canvas.height = clientHeight;
            draw();
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [transform, clusters, frozenClusterIds, frozenAssignments]);

    const handleWheel = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const zoomSpeed = 0.005;
        const factor = Math.pow(1.1, -e.deltaY * zoomSpeed);
        const newScale = Math.max(0.1, Math.min(transform.scale * factor, 20));
        const zoomFactor = newScale / transform.scale;
        const mouseX = e.clientX - canvas.width / 2;
        const mouseY = e.clientY - canvas.height / 2;
        setTransform(prev => ({
            scale: newScale,
            x: mouseX - (mouseX - prev.x) * zoomFactor,
            y: mouseY - (mouseY - prev.y) * zoomFactor
        }));
    };

    const handleMouseDown = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - (canvas.width / 2 + transform.x)) / transform.scale;
        const worldY = (mouseY - (canvas.height / 2 + transform.y)) / transform.scale;

        const coreIndex = clusters.findIndex(c => {
            const d = Math.sqrt((c.x - worldX) ** 2 + (c.y - worldY) ** 2);
            return d < 12 / transform.scale;
        });

        if (coreIndex !== -1) {
            const clusterId = clusters[coreIndex].id;
            if (!frozenClusterIds.has(clusterId)) {
                draggingCoreId.current = clusters[coreIndex].coreId || clusters[coreIndex].id;
            } else {
                isDragging.current = true;
            }
        } else {
            isDragging.current = true;
        }

        lastMousePos.current = { x: e.clientX, y: e.clientY };
        clickStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = (e) => {
        const wasDraggingCore = draggingCoreId.current !== null;
        draggingCoreId.current = null;

        if (isDragging.current || wasDraggingCore) {
            const dx = e.clientX - clickStartPos.current.x;
            const dy = e.clientY - clickStartPos.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5 && !wasDraggingCore) {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const worldX = (mouseX - (canvas.width / 2 + transform.x)) / transform.scale;
                const worldY = (mouseY - (canvas.height / 2 + transform.y)) / transform.scale;

                const isOverCore = clusters.some(c => {
                    const d = Math.sqrt((c.x - worldX) ** 2 + (c.y - worldY) ** 2);
                    return d < 12 / transform.scale;
                });

                if (clickTimeoutRef.current) {
                    clearTimeout(clickTimeoutRef.current);
                    clickTimeoutRef.current = null;
                } else if (!isOverCore) {
                    clickTimeoutRef.current = setTimeout(() => {
                        let minDistToBox = 10; // Proximity threshold in world units
                        let existingClusterId = null;
                        let existingClusterColor = null;

                        rectsRef.current.forEach((r, i) => {
                            const closestX = Math.max(r.x, Math.min(worldX, r.x + r.width));
                            const closestY = Math.max(r.y, Math.min(worldY, r.y + r.height));
                            const dx = worldX - closestX;
                            const dy = worldY - closestY;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            if (dist < minDistToBox && currentAssignmentsRef.current[i]) {
                                minDistToBox = dist;
                                existingClusterId = currentAssignmentsRef.current[i].id;
                                existingClusterColor = currentAssignmentsRef.current[i].color;
                            }
                        });

                        if (existingClusterId) {
                            setClusters(prev => [...prev, {
                                x: worldX, y: worldY,
                                id: existingClusterId,
                                color: existingClusterColor,
                                coreId: Date.now()
                            }]);
                        } else {
                            // Find a hue that is distinct from existing clusters
                            let hue = Math.floor(Math.random() * 360);
                            const existingHues = Array.from(new Set(clusters.map(c => {
                                const m = c.color.match(/hsl\((\d+)/);
                                return m ? parseInt(m[1]) : null;
                            }))).filter(h => h !== null);

                            // Try up to 20 times to find a hue at least 20 degrees away
                            for (let i = 0; i < 20; i++) {
                                const isDistant = existingHues.every(h => {
                                    const diff = Math.abs(h - hue);
                                    return diff > 20 && diff < 340;
                                });
                                if (isDistant) break;
                                hue = Math.floor(Math.random() * 360);
                            }

                            const color = `hsl(${hue}, 70%, 50%)`;
                            setClusters(prev => [...prev, {
                                x: worldX, y: worldY,
                                id: Date.now(),
                                color,
                                coreId: Date.now()
                            }]);
                        }
                        clickTimeoutRef.current = null;
                    }, 250);
                }
            }
        }
        isDragging.current = false;
    };

    const handleDoubleClick = (e) => {
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - (canvas.width / 2 + transform.x)) / transform.scale;
        const worldY = (mouseY - (canvas.height / 2 + transform.y)) / transform.scale;

        // Check if on core -> Remove logic
        const coreIdx = clusters.findIndex(c => {
            const d = Math.sqrt((c.x - worldX) ** 2 + (c.y - worldY) ** 2);
            return d < 12 / transform.scale;
        });

        if (coreIdx !== -1) {
            const clusterId = clusters[coreIdx].id;
            setClusters(prev => {
                const newClusters = prev.filter((_, i) => i !== coreIdx);
                // If the whole cluster is gone, unfreeze it
                if (!newClusters.some(c => c.id === clusterId)) {
                    setFrozenClusterIds(f => {
                        const n = new Set(f);
                        n.delete(clusterId);
                        return n;
                    });
                    setFrozenAssignments(f => {
                        const n = { ...f };
                        delete n[clusterId];
                        return n;
                    });
                }
                return newClusters;
            });
            return;
        }

        // Check if on or near an existing cluster (box) -> Freeze/Unfreeze
        let minDistToBox = 10;
        let clickedBoxIdx = -1;
        rectsRef.current.forEach((r, i) => {
            const closestX = Math.max(r.x, Math.min(worldX, r.x + r.width));
            const closestY = Math.max(r.y, Math.min(worldY, r.y + r.height));
            const dx = worldX - closestX;
            const dy = worldY - closestY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDistToBox && currentAssignmentsRef.current[i]) {
                minDistToBox = dist;
                clickedBoxIdx = i;
            }
        });

        if (clickedBoxIdx !== -1) {
            const assigned = currentAssignmentsRef.current[clickedBoxIdx];
            if (assigned) {
                const clusterId = assigned.id;
                setFrozenClusterIds(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(clusterId)) {
                        newSet.delete(clusterId);
                        setFrozenAssignments(f => {
                            const n = { ...f };
                            delete n[clusterId];
                            return n;
                        });
                    } else {
                        newSet.add(clusterId);
                        // Freeze current box assignments for this cluster
                        const boxIndices = [];
                        currentAssignmentsRef.current.forEach((a, idx) => {
                            if (a && a.id === clusterId) boxIndices.push(idx);
                        });
                        setFrozenAssignments(f => ({ ...f, [clusterId]: boxIndices }));
                    }
                    return newSet;
                });
            }
        }
    };

    const handleMouseMove = (e) => {
        if (draggingCoreId.current) {
            const dx = (e.clientX - lastMousePos.current.x) / transform.scale;
            const dy = (e.clientY - lastMousePos.current.y) / transform.scale;
            setClusters(prev => prev.map(c =>
                (c.coreId || c.id) === draggingCoreId.current ? { ...c, x: c.x + dx, y: c.y + dy } : c
            ));
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (!isDragging.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const getCursorStyle = () => {
        if (draggingCoreId.current || isDragging.current) return 'grabbing';
        return 'grab';
    };

    return (
        <div
            className="canvas-container"
            style={{ width: '100%', height: '100vh', overflow: 'hidden', cursor: getCursorStyle() }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onMouseLeave={() => {
                isDragging.current = false;
                draggingCoreId.current = null;
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    );
};

export default Canvas;
