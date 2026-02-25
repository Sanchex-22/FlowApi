const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Convierte un número secuencial a base-36 (alfanuméricos)
 * @param num - Número secuencial a convertir
 * @returns String de 6 caracteres alfanuméricos
 */
function numToBase36(num: number): string {
    let result = '';
    let n = num;

    for (let i = 0; i < 6; i++) {
        result = ALPHANUMERIC[n % 36] + result;
        n = Math.floor(n / 36);
    }

    return result.padStart(6, '0');
}

/**
 * Convierte un string base-36 a número decimal
 */
function base36ToNum(str: string): number {
    let num = 0;
    for (let i = 0; i < str.length; i++) {
        num = num * 36 + ALPHANUMERIC.indexOf(str[i]);
    }
    return num;
}

/**
 * Genera el siguiente plateNumber secuencial
 * @param prisma - Instancia de Prisma
 * @returns Número de placa en formato IT-XXXXXX
 */
export async function generatePlateNumber(prisma: any): Promise<string> {
    try {
        // ✅ Obtener TODOS los plateNumbers existentes para encontrar el máximo
        const allEquipment = await prisma.equipment.findMany({
            where: {
                plateNumber: {
                    startsWith: 'IT-'
                }
            },
            select: { plateNumber: true },
            orderBy: { createdAt: 'asc' }
        });

        console.log(`📊 Equipos con plateNumber encontrados: ${allEquipment.length}`);

        let maxSequence = -1;

        // Encontrar el número más alto
        for (const eq of allEquipment) {
            if (eq.plateNumber) {
                const alphanumericPart = eq.plateNumber.substring(3); // Quitar "IT-"
                const sequence = base36ToNum(alphanumericPart);
                if (sequence > maxSequence) {
                    maxSequence = sequence;
                    console.log(`🔢 Encontrado: ${eq.plateNumber} (secuencia: ${sequence})`);
                }
            }
        }

        // El siguiente número será maxSequence + 1
        const nextSequence = maxSequence + 1;
        const base36String = numToBase36(nextSequence);
        const candidatePlate = `IT-${base36String}`;

        console.log(`✅ Siguiente plateNumber generado: ${candidatePlate} (secuencia: ${nextSequence})`);

        return candidatePlate;

    } catch (error) {
        console.error('❌ Error generando plateNumber:', error);
        throw new Error('Error al generar número de placa');
    }
}

/**
 * Valida que un plateNumber tenga el formato correcto
 * @param plateNumber - Número de placa a validar
 * @returns true si es válido
 */
export function isValidPlateNumber(plateNumber: string): boolean {
    const regex = /^IT-[0-9A-Z]{6}$/;
    return regex.test(plateNumber);
}