import { world, system, Player, Vector3, Vector2 } from "@minecraft/server";

world.beforeEvents.itemUse.subscribe((e) => {
    const pl = e.source;
    if (e.itemStack.typeId == "lim:sirens_tears") {
        const is_mermaid = pl.getProperty("lim:is_mermaid") as boolean;

        if (is_mermaid) {
            system.run(() => { pl.setProperty("lim:is_mermaid", false); });
        } else {
            system.run(() => { pl.setProperty("lim:is_mermaid", true); });
        }

    } else if (e.itemStack.typeId == "lim:elixir") {
        const color = pl.getProperty("lim:color") as number;
        system.run(() => { pl.setProperty("lim:color", (color + 1) % 11); });
    }
});

const usingPlayers = new Set();

world.beforeEvents.itemUse.subscribe((e) => {
    const pl = e.source;
    if (e.itemStack.typeId == "lim:sea_of_lament") {
        const using_staff = pl.getProperty("lim:using_staff") as boolean;

        if (using_staff) {
            usingPlayers.add(pl.id);
            system.run(() => { pl.setProperty("lim:using_staff", false); });

        }
    }
});
world.afterEvents.itemStopUse.subscribe((e) => {
    const pl = e.source;
    if (e.itemStack.typeId == "lim:sea_of_lament") {
        const using_staff = pl.getProperty("lim:using_staff") as boolean;
        usingPlayers.delete(pl.id);
        system.run(() => { pl.setProperty("lim:using_staff", true); });
    }
});


system.runInterval(() => {
    for (const pl of world.getPlayers()) {
        if (!pl.isValid) continue;

        let mana = pl.getProperty("lim:mana") as number;
        const is_mermaid = pl.getProperty("lim:is_mermaid") as boolean;
        if (mana === undefined || isNaN(mana)) mana = 50; // 마나 값이 없을 경우 기본값 설정

        // 마나 사용량 (2틱마다 -1)
        if (usingPlayers.has(pl.id)) {
            if (mana >= 1) {
                spawnMissile(pl);
                spawnMissile(pl);
                mana -= 1;
                pl.setProperty("lim:mana", mana);
            } else {
                //pl.sendMessage(`no Mana`);

            }
        }

        // 자연 치유량 (10틱마다 +1)
        if (system.currentTick % 10 === 0) {
            if (mana < 50) mana += 1;
        }

        // 물속이거나 비 올 때 추가 회복 (3틱마다 +1)
        if ((pl.isInWater || pl.dimension.getWeather() !== "Clear") && system.currentTick % 3 === 0) {
            if (mana < 50) mana += 1;
        }
        if (is_mermaid) {
            if (mana < 50) mana += 1;
        }

        pl.setProperty("lim:mana", mana); // 변경된 마나 저장

    }
}, 0); // 2틱마다 실행



function spawnMissile(pl) {
    const loc: Vector3 = pl.getHeadLocation();
    const viewDirection: Vector3 = pl.getViewDirection();

    // 마법진 중심 위치 (플레이어 앞 3블록)
    const magicCircleCenter: Vector3 = {
        x: loc.x + viewDirection.x * 3,
        y: loc.y + viewDirection.y * 3,
        z: loc.z + viewDirection.z * 3
    };

    const radius = 1.2;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;

    // 랜덤 오차 추가
    const deviationAngle = (Math.random() - 0.5) * Math.PI * 0.15; // 최대 ±8.5도 오차
    const deviationAxis = normalize(crossProduct(viewDirection, { x: 0, y: 1, z: 0 }));

    const right = normalize(crossProduct(viewDirection, { x: 0, y: 1, z: 0 }));
    const up = normalize(crossProduct(right, viewDirection));

    const localPos: Vector3 = {
        x: right.x * (r * Math.cos(angle)) + up.x * (r * Math.sin(angle)),
        y: right.y * (r * Math.cos(angle)) + up.y * (r * Math.sin(angle)),
        z: right.z * (r * Math.cos(angle)) + up.z * (r * Math.sin(angle))
    };

    const spawnX = magicCircleCenter.x + localPos.x;
    const spawnY = magicCircleCenter.y + localPos.y;
    const spawnZ = magicCircleCenter.z + localPos.z;

    const projectile = pl.dimension.spawnEntity("lim:magic_missile", { x: spawnX, y: spawnY, z: spawnZ }, {
        initialPersistence: true
    });

    let shootDir = rotateVector(viewDirection, deviationAxis, deviationAngle);
    shootDir = normalize(shootDir); // 다시 정규화

    let shooter = projectile.getComponent('projectile');
    shooter.owner = pl;
    shooter.shoot({ x: shootDir.x * 3, y: shootDir.y * 3, z: shootDir.z * 3 }, { uncertainty: 0 });

    trackMissile(projectile, pl);
}

// 회전 변환 함수 (축과 각도로 벡터 회전)
function rotateVector(vector: Vector3, axis: Vector3, angle: number): Vector3 {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    return {
        x: (cosA + (1 - cosA) * axis.x * axis.x) * vector.x +
            ((1 - cosA) * axis.x * axis.y - axis.z * sinA) * vector.y +
            ((1 - cosA) * axis.x * axis.z + axis.y * sinA) * vector.z,

        y: ((1 - cosA) * axis.y * axis.x + axis.z * sinA) * vector.x +
            (cosA + (1 - cosA) * axis.y * axis.y) * vector.y +
            ((1 - cosA) * axis.y * axis.z - axis.x * sinA) * vector.z,

        z: ((1 - cosA) * axis.z * axis.x - axis.y * sinA) * vector.x +
            ((1 - cosA) * axis.z * axis.y + axis.x * sinA) * vector.y +
            (cosA + (1 - cosA) * axis.z * axis.z) * vector.z
    };
}


function normalize(vector: Vector3): Vector3 {
    const length = Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
    return length === 0 ? { x: 0, y: 0, z: 0 } : { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function crossProduct(v1: Vector3, v2: Vector3): Vector3 {
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };
}

function trackMissile(projectile, shooter) {
    system.runInterval(() => {
        if (!projectile.isValid()) return;

        const target = findClosestTarget(projectile, shooter);
        if (!target) return;

        const missilePos: Vector3 = projectile.location;
        const targetPos: Vector3 = {
            x: target.location.x,
            y: target.location.y + 1,
            z: target.location.z
        };

        // 목표 방향 벡터 계산 (정규화)
        let targetDir: Vector3 = {
            x: targetPos.x - missilePos.x,
            y: targetPos.y - missilePos.y,
            z: targetPos.z - missilePos.z
        };
        const length = Math.sqrt(targetDir.x ** 2 + targetDir.y ** 2 + targetDir.z ** 2);
        if (length === 0) return;
        targetDir.x /= length;
        targetDir.y /= length;
        targetDir.z /= length;

        // 현재 속도 가져오기
        let currentVel = projectile.getVelocity();
        let speed = Math.sqrt(currentVel.x ** 2 + currentVel.y ** 2 + currentVel.z ** 2);

        // 속도 유지 (목표와 가까워져도 느려지지 않음)
        const fixedSpeed = 4; // 항상 일정한 속도를 유지
        speed = Math.max(speed, fixedSpeed); // 최소 속도 보장

        // 기존 속도를 유지하며 목표 방향으로 보간
        const blendFactor = 0.8; // 기존 속도 유지 비율
        let newVelocity: Vector3 = {
            x: currentVel.x * blendFactor + targetDir.x * (1 - blendFactor) * fixedSpeed,
            y: currentVel.y * blendFactor + targetDir.y * (1 - blendFactor) * fixedSpeed,
            z: currentVel.z * blendFactor + targetDir.z * (1 - blendFactor) * fixedSpeed
        };

        // 속도 크기 강제 유지 (감속 제거)
        const newSpeed = Math.sqrt(newVelocity.x ** 2 + newVelocity.y ** 2 + newVelocity.z ** 2);
        newVelocity.x *= fixedSpeed / newSpeed;
        newVelocity.y *= fixedSpeed / newSpeed;
        newVelocity.z *= fixedSpeed / newSpeed;

        // 가속 적용 (빠른 반응)
        let newImpulse: Vector3 = {
            x: (newVelocity.x - currentVel.x) * 0.8,
            y: (newVelocity.y - currentVel.y) * 0.8,
            z: (newVelocity.z - currentVel.z) * 0.8
        };

        projectile.applyImpulse(newImpulse);
    }, 1);
}


function findClosestTarget(missile, shooter) {
    const maxRange = 25;
    let closestTarget = null;
    let closestDistance = maxRange;

    for (const entity of missile.dimension.getEntities()) {

        if (entity.id === shooter.id || entity.id === missile.id || entity.typeId === "lim:magic_missile") continue;// 유도 대상 검사
        if (!entity.isValid) continue;

        const entityPos: Vector3 = entity.location;
        const missilePos: Vector3 = missile.location;

        const distance = Math.sqrt(
            (entityPos.x - missilePos.x) ** 2 +
            (entityPos.y + 1 - missilePos.y) ** 2 +
            (entityPos.z - missilePos.z) ** 2
        );

        if (distance < closestDistance) {
            closestDistance = distance;
            closestTarget = entity;
        }
    }

    return closestTarget;
}

