clear all
close all
[filename, path]=uigetfile('.csv'); % Dateinamen in Verszeichnis
Raw_Data=dlmread(fullfile(path,filename)); %ließt csv Datei ein
max_X=max(max(Raw_Data(:,2:2:end)));%+max(max(Raw_Data(:,2:2:end)))*0.5;
min_X=min(min(Raw_Data(:,2:2:end)));%-min(min(Raw_Data(:,2:2:end)))*0.5;
max_Y=max(max(Raw_Data(:,3:2:end)));%+max(max(Raw_Data(:,3:2:end)))*0.5;
min_Y=min(min(Raw_Data(:,3:2:end)));%+min(min(Raw_Data(:,3:2:end)))*0.5;
k=figure(1);
k.Visible='off';
h=waitbar(0,'Collecting Data');
name=["   b","  a","   c","   g","  f"];
for j=1:1:size(Raw_Data,1)
k=1;
    for i=2:2:size(Raw_Data,2)
        plot([Raw_Data(j,4) Raw_Data(j,6)],[Raw_Data(j,5),Raw_Data(j,7)],'-b')
        plot([Raw_Data(j,2) Raw_Data(j,6)],[Raw_Data(j,3),Raw_Data(j,7)],'-b')
        %plot([Raw_Data(j,10) Raw_Data(j,12)],[Raw_Data(j,11),Raw_Data(j,13)],'-b')
        plot(Raw_Data(j,i),Raw_Data(j,i+1),'+')
        text(Raw_Data(j,i),Raw_Data(j,i+1),char(name(k)));
        axis([min_X max_X min_Y max_Y]);
        hold on
        F(j) = getframe(gcf) ;
        drawnow
        k=k+1;
    end
    hold off 
    waitbar(j/size(Raw_Data,1),h)
end
close(h)
% create the video writer with 1 fps
writerObj = VideoWriter('myVideo.avi');
writerObj.FrameRate = 24;
% set the seconds per image
%  open the video writer
open(writerObj);
% write the frames to the video
for i=1:length(F)
    % convert the image to a frame
    frame = F(i) ;
    writeVideo(writerObj, frame);
end
% % close the writer object
close(writerObj);

%% Wie viele Bewegungspunkte ? --> 7 Stück und dann fragt er, welche Bewgeungen sollen verbunden werden?
%% 1. Zeile löschen
%% soll fragen wie viel Bewegungen sind es ? und welche sollen verbunden werden?
