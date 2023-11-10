# WebPolarReader
A javascript program to read data from multiple Polar devices (H10 &amp; Verity Sense)

The bluetooth protocol/API is now supported by many different browsers. The program also attempts to detect heart beats from either PPG (Verity Sense) or ECG (H10) devices. You might need to use the scaling buttons for the PPG as the detection algorithm uses the scaling variable for detection. I might need to alter the routine for the ECG. Unfortunately my ECG has a QRS complex that exceeds 4 mV - most of my students have much smaller waveforms (~1.5 mV) which makes testing on myself misleading.

I still need to make a shorter download button so that just the PPG and QRS peaks are included without the full data - which can be VERY long - and easily exceed what Excel can cope with.
Have fun and if you have any suggestions, please do email: cjs30@cam.ac.uk
