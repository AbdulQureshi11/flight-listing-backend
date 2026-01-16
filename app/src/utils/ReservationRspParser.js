import xml2js from "xml2js";
export const parseBookingResponse = async (xmlResponse) => {
  try {
    // Parse XML to JavaScript object
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix], // Remove namespace prefixes
    });

    const result = await parser.parseStringPromise(xmlResponse);

    // Navigate to the response body
    const envelope = result?.Envelope;
    const body = envelope?.Body;

    // Check for SOAP Fault
    if (body?.Fault) {
      const faultString = body.Fault.faultstring || "Unknown error";
      throw new Error(`SOAP Fault: ${faultString}`);
    }

    // Get AirCreateReservationRsp
    const reservationRsp = body?.AirCreateReservationRsp;
    if (!reservationRsp) {
      throw new Error("No AirCreateReservationRsp found in response");
    }

    // Extract response metadata
    const transactionId = reservationRsp.TransactionId;
    const responseTime = reservationRsp.ResponseTime;

    // Extract warnings/messages
    const warnings = extractMessages(reservationRsp.ResponseMessage);

    // Get UniversalRecord
    const universalRecord = reservationRsp.UniversalRecord;
    if (!universalRecord) {
      throw new Error("No UniversalRecord found in response");
    }

    // Extract Universal Record identifiers
    const urLocatorCode = universalRecord.LocatorCode;
    const urVersion = universalRecord.Version;
    const urStatus = universalRecord.Status;

    // Extract BookingTraveler info
    const bookingTravelers = extractBookingTravelers(
      universalRecord.BookingTraveler
    );

    // Extract ActionStatus (ticketing deadline)
    const actionStatus = universalRecord.ActionStatus;
    const ticketingDeadline = actionStatus?.TicketDate;

    // Extract ProviderReservationInfo
    const providerReservationInfo = universalRecord.ProviderReservationInfo;
    const providerPNR = providerReservationInfo?.LocatorCode;
    const providerCode = providerReservationInfo?.ProviderCode;
    const createDate = providerReservationInfo?.CreateDate;
    const modifiedDate = providerReservationInfo?.ModifiedDate;
    const hostCreateDate = providerReservationInfo?.HostCreateDate;
    const owningPCC = providerReservationInfo?.OwningPCC;

    // Extract AirReservation
    const airReservation = universalRecord.AirReservation;
    if (!airReservation) {
      throw new Error("No AirReservation found in response");
    }

    const airLocatorCode = airReservation.LocatorCode;
    const airCreateDate = airReservation.CreateDate;
    const airModifiedDate = airReservation.ModifiedDate;

    // Extract SupplierLocator (airline confirmation)
    const supplierLocator = airReservation.SupplierLocator;
    const airlineConfirmation = supplierLocator?.SupplierLocatorCode;
    const supplierCode = supplierLocator?.SupplierCode;
    const supplierCreateDateTime = supplierLocator?.CreateDateTime;

    // Extract Flight Segments
    const segments = extractSegments(airReservation.AirSegment);

    // Extract Pricing Information
    const pricingInfo = extractPricingInfo(airReservation.AirPricingInfo);

    // Extract Form of Payment
    const formOfPayment = universalRecord.FormOfPayment;
    const paymentType = formOfPayment?.Type;
    const paymentReusable = formOfPayment?.Reusable;

    // Extract Agency Info
    const agencyInfo = universalRecord.AgencyInfo;
    const agentAction = agencyInfo?.AgentAction;
    const agentCode = agentAction?.AgentCode;
    const agencyCode = agentAction?.AgencyCode;
    const branchCode = agentAction?.BranchCode;
    const actionType = agentAction?.ActionType;
    const eventTime = agentAction?.EventTime;

    // Extract schedule change information (if any)
    const solutionChanged = body.AirSolutionChangedInfo;
    const scheduleChanges = solutionChanged
      ? extractScheduleChanges(solutionChanged)
      : null;

    // Build structured response
    return {
      success: true,
      booking: {
        // Main identifiers
        bookingId: urLocatorCode,
        pnr: providerPNR,
        airReservationLocator: airLocatorCode,
        airlineConfirmation: airlineConfirmation,

        // Status
        status: urStatus,
        version: urVersion,

        // Provider info
        provider: {
          code: providerCode,
          pcc: owningPCC,
          supplierCode: supplierCode,
        },

        // Important dates
        createdAt: createDate,
        modifiedAt: modifiedDate,
        hostCreateDate: hostCreateDate,
        ticketingDeadline: ticketingDeadline,
        supplierCreateDateTime: supplierCreateDateTime,

        // Passengers
        passengers: bookingTravelers,

        // Flight details
        segments: segments,

        // Pricing
        pricing: pricingInfo,

        // Payment
        payment: {
          type: paymentType,
          reusable: paymentReusable === "true",
        },

        // Agent/Agency
        agent: {
          code: agentCode,
          agency: agencyCode,
          branch: branchCode,
          actionType: actionType,
          timestamp: eventTime,
        },

        // Warnings/Messages
        warnings: warnings,

        // Schedule changes (if any)
        scheduleChanges: scheduleChanges,
      },

      // Raw metadata
      metadata: {
        transactionId: transactionId,
        responseTime: responseTime,
      },
    };
  } catch (error) {
    console.error("❌ Error parsing booking response:", error);
    throw error;
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract response messages/warnings
 */
const extractMessages = (messageData) => {
  if (!messageData) return [];

  const messages = Array.isArray(messageData) ? messageData : [messageData];

  return messages.map((msg) => ({
    code: msg?.Code,
    type: msg?.Type,
    providerCode: msg?.ProviderCode,
    message: msg?._ || msg,
  }));
};

/**
 * Extract booking traveler information
 */
const extractBookingTravelers = (travelerData) => {
  if (!travelerData) return [];

  const travelers = Array.isArray(travelerData) ? travelerData : [travelerData];

  return travelers.map((traveler) => {
    const name = traveler.BookingTravelerName;
    const phone = traveler.PhoneNumber;
    const email = traveler.Email;

    return {
      key: traveler?.Key,
      type: traveler?.TravelerType,
      firstName: name?.First,
      lastName: name?.Last,
      dob: traveler?.DOB,
      gender: traveler?.Gender,
      elStat: traveler?.ElStat,
      phone: phone?.Number,
      phoneType: phone?.Type,
      phoneLocation: phone?.Location,
      email: email?.EmailID,
    };
  });
};

/**
 * Extract flight segments
 */
const extractSegments = (segmentData) => {
  if (!segmentData) return [];

  const segments = Array.isArray(segmentData) ? segmentData : [segmentData];

  return segments.map((segment) => {
    const flightDetails = segment.FlightDetails;
    const sellMessages = segment.SellMessage;
    const connection = segment.Connection;

    return {
      key: segment?.Key,
      group: segment?.Group,
      carrier: segment?.Carrier,
      flightNumber: segment?.FlightNumber,
      origin: segment?.Origin,
      destination: segment?.Destination,
      departureTime: segment?.DepartureTime,
      arrivalTime: segment?.ArrivalTime,
      travelTime: segment?.TravelTime,
      distance: segment?.Distance,
      cabin: segment?.CabinClass,
      bookingClass: segment?.ClassOfService,
      status: segment?.Status,
      equipment: segment?.Equipment,
      eTicketability: segment?.ETicketability,
      changeOfPlane: segment?.ChangeOfPlane === "true",
      travelOrder: segment?.TravelOrder,
      providerSegmentOrder: segment?.ProviderSegmentOrder,
      availabilitySource: segment?.AvailabilitySource,
      elStat: segment?.ElStat,

      // Connection info
      connection: connection
        ? {
            duration: connection?.Duration,
          }
        : null,

      // Flight details
      flightDetails: flightDetails
        ? {
            origin: flightDetails?.Origin,
            destination: flightDetails?.Destination,
            departureTime: flightDetails?.DepartureTime,
            arrivalTime: flightDetails?.ArrivalTime,
            flightTime: flightDetails?.FlightTime,
            travelTime: flightDetails?.TravelTime,
            equipment: flightDetails?.Equipment,
            originTerminal: flightDetails?.OriginTerminal,
            destinationTerminal: flightDetails?.DestinationTerminal,
            automatedCheckin: flightDetails?.AutomatedCheckin === "true",
          }
        : null,

      // Airline messages
      messages: Array.isArray(sellMessages)
        ? sellMessages
        : sellMessages
        ? [sellMessages]
        : [],
    };
  });
};

/**
 * Extract pricing information
 */
const extractPricingInfo = (pricingData) => {
  if (!pricingData) return null;

  const fareInfos = pricingData.FareInfo;
  const taxInfos = pricingData.TaxInfo;
  const fareCalc = pricingData.FareCalc;
  const bookingInfos = pricingData.BookingInfo;
  const changePenalty = pricingData.ChangePenalty;
  const cancelPenalty = pricingData.CancelPenalty;
  const passengerType = pricingData.PassengerType;
  const fareGuarantee = passengerType?.FareGuaranteeInfo;

  // Extract fare details
  const fares = Array.isArray(fareInfos) ? fareInfos : [fareInfos];
  const fareDetails = fares.filter(Boolean).map((fare) => {
    const baggageAllowance = fare.BaggageAllowance;
    const endorsement = fare.Endorsement;

    return {
      key: fare?.Key,
      fareBasis: fare?.FareBasis,
      origin: fare?.Origin,
      destination: fare?.Destination,
      passengerType: fare?.PassengerTypeCode,
      amount: fare?.Amount,
      effectiveDate: fare?.EffectiveDate,
      notValidBefore: fare?.NotValidBefore,
      notValidAfter: fare?.NotValidAfter,
      pseudoCityCode: fare?.PseudoCityCode,
      elStat: fare?.ElStat,
      baggage: baggageAllowance
        ? {
            pieces: baggageAllowance.NumberOfPieces,
          }
        : null,
      endorsement: endorsement?.Value,
    };
  });

  // Extract booking info (class of service mapping)
  const bookings = Array.isArray(bookingInfos)
    ? bookingInfos
    : bookingInfos
    ? [bookingInfos]
    : [];
  const bookingDetails = bookings.map((booking) => ({
    bookingCode: booking?.BookingCode,
    cabin: booking?.CabinClass,
    fareInfoRef: booking?.FareInfoRef,
    segmentRef: booking?.SegmentRef,
  }));

  // Extract taxes
  const taxes = Array.isArray(taxInfos) ? taxInfos : taxInfos ? [taxInfos] : [];
  const taxDetails = taxes.map((tax) => ({
    key: tax?.Key,
    category: tax?.Category,
    amount: tax?.Amount,
  }));

  return {
    key: pricingData?.Key,
    totalPrice: pricingData?.TotalPrice,
    basePrice: pricingData?.BasePrice,
    approximateTotalPrice: pricingData?.ApproximateTotalPrice,
    approximateBasePrice: pricingData?.ApproximateBasePrice,
    equivalentBasePrice: pricingData?.EquivalentBasePrice,
    taxes: pricingData?.Taxes,
    latestTicketingTime: pricingData?.LatestTicketingTime,
    trueLastDateToTicket: pricingData?.TrueLastDateToTicket,
    pricingMethod: pricingData?.PricingMethod,
    refundable: pricingData?.Refundable === "true",
    exchangeable: pricingData?.Exchangeable === "true",
    includesVAT: pricingData?.IncludesVAT === "true",
    eTicketability: pricingData?.ETicketability,
    platingCarrier: pricingData?.PlatingCarrier,
    providerCode: pricingData?.ProviderCode,
    airPricingInfoGroup: pricingData?.AirPricingInfoGroup,
    pricingType: pricingData?.PricingType,
    fareCalculationInd: pricingData?.FareCalculationInd,
    elStat: pricingData?.ElStat,

    // Detailed breakdown
    fares: fareDetails,
    bookings: bookingDetails,
    taxBreakdown: taxDetails,
    fareCalculation: fareCalc,

    // Passenger type and guarantee
    passengerType: passengerType?.Code,
    fareGuarantee: fareGuarantee
      ? {
          guaranteeDate: fareGuarantee?.GuaranteeDate,
          guaranteeType: fareGuarantee?.GuaranteeType,
        }
      : null,

    // Penalties
    changePenalty: changePenalty
      ? {
          penaltyApplies: changePenalty?.PenaltyApplies,
          amount: changePenalty.Amount,
        }
      : null,
    cancelPenalty: cancelPenalty
      ? {
          penaltyApplies: cancelPenalty?.PenaltyApplies,
          amount: cancelPenalty.Amount,
        }
      : null,
  };
};

/**
 * Extract schedule change information
 */
const extractScheduleChanges = (changeInfo) => {
  if (!changeInfo) return null;

  const reasonCode = changeInfo?.ReasonCode;
  const airPricingSolution = changeInfo.AirPricingSolution;

  if (!airPricingSolution) return null;

  const changedSegments = extractSegments(airPricingSolution.AirSegment);

  return {
    reason: reasonCode,
    solutionKey: airPricingSolution?.Key,
    segments: changedSegments,
  };
};

// ==================== EXPORT ====================
export default parseBookingResponse;
