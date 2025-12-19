export const calculateFinalPrice = ({
    baseFare,
    taxes,
    serviceFee = 0,
    markupPercent = 0
}) => {
    const base = Number(baseFare);
    const tax = Number(taxes);

    const markupAmount = (base * markupPercent) / 100;

    const total =
        base +
        tax +
        serviceFee +
        markupAmount;

    return {
        baseFare: base,
        taxes: tax,
        serviceFee,
        markupPercent,
        markupAmount,
        total: Math.round(total)
    };
};
