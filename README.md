# WebPolarReader
A javascript program to read data from multiple Polar devices (H10 &amp; Verity Sense)

The bluetooth protocol/API is now supported by many different browsers. The program also attempts to detect heart beats from either PPG (Verity Sense) or ECG (H10) devices. You might need to use the scaling buttons for the PPG and ECG as the detection algorithm uses the scaling variable for detection.

[https://github.com/cjs30/WebPolarReader/blob/main/VerityCollectionToolv0.057.html] now provides a download of two files. The RAW file contains everything and can be quite large. The other file contains just the derived data - ie peaks in PPG and the R wave time.

The column headings and description are:

_RAW files

  PPGsum - This is the sum of the 3 Verity Sense light sensors. See Javascript line: PPGsum[i]=NewPPG[0][i]+NewPPG[1][i]+NewPPG[2][i] 

  PPGsum_f - PPGsum filtered/smoothed with a FIR (see: smoothPPG(devicename,dataobject,[0.025,0.04,0.07,0.13,0.2,0.22,0.2,0.13,0.07,0.04,0.025]))
  
  PPG_f_reduced - PPGsum but with the number of datapoints reduced by a Ramer–Douglas–Peucker (RDP) algorithm that linearly interpolates values to the resolution displayed. This speeds up the display as plotting PPG_f could slow data collection. The trace is also useful when attempting to plot long time series using Excel etc.
  
  PPGrate - rate of change of PPGsum_f (see: ratePPG(devicename,data))
  
  PPGacceleration - rate of change of PPGrate (see: ratePPG(devicename,data) for the duration of the acceleration calculation - currently 4 data points to reduce noise)
  
  PPGrate_reduced - RDP reduced PPGrate used for display during data collection and again use for plotting in Excel.
  
  PPGpeak - List of PPG peaks see: function detectPPGpeak(devicename,data) for the algorithm and assumptions (e.g. max heart rate which might introduce issues under some circumstances)
  
  PPGstart and PPGend - 'start' and 'end' of PPG waveform based on thresholds, see: function getPPGStart(data,minrate) and derivation of minrate
  
  [descriptions to be continued]
  
  
  Have fun and if you have any suggestions, please do email: cjs30@cam.ac.uk
