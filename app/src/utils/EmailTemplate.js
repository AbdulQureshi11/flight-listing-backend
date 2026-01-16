export const getOtpTemplate = (otp) => `
  <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px;">
    <h2 style="color: #764ba2;">Verification Code</h2>
    <p>Use the code below to verify your booking:</p>
    <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${otp}</div>
    <p>This code expires in 10 minutes.</p>
  </div>
`;

export const getBookingTemplate = (bookingData) => {
  const { pnr, passengers, totalPrice } = bookingData;
  return `
    <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px;">
      <h2 style="color: #2c3e50;">Reservation Confirmed!</h2>
      <p>Your booking is successful. Here are the details:</p>
      <p><strong>PNR:</strong> ${pnr}</p>
      <p><strong>Passengers:</strong> ${passengers.length}</p>
      <p><strong>Total Paid:</strong> ${totalPrice}</p>
      <p>Thank you for choosing our service.</p>
    </div>
  `;
};
