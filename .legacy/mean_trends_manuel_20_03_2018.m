%%% Mean Trends
%%% This script allows you to build a mean trend from many trends
%%% The mean trend will also have the mean length of all trends
clear all;
close all;
clc;
[filename, path]=uigetfile('.csv'); % Dateinamen in Verszeichnis
Raw_data=dlmread(fullfile(path,filename)); %ließt csv Datei ein
[max_row, max_col]=size(Raw_data);
X=Raw_data(:,1:1:max_col);
prompt = {'Wieviele unterschiedliche Bewegungen?'};
dlg_title = 'Input parameters';
num_lines = 1;
defaultans = {''};
answer = inputdlg(prompt,dlg_title,num_lines,defaultans);
Bewegung=str2double(answer{1});
if strcmp(questdlg('do you want to use 100 as base or mean of all motions?','Question','mean', '100', 'mean'), 'mean')
    choice_mean=1;
else
    choice_mean=0;
end
for i=1:1:size(Raw_data,2)   % X
    clear temp_X
    temp_X=X(:,i);
    mean_time_X(i,1)=size(temp_X(temp_X ~= 0),1);
end
for i=1:1:size(Raw_data,2)
    clear temp_X
    temp_X=X(:,i);
    temp_X = temp_X(temp_X ~= 0);
    if choice_mean==1
        H_X(:,i)=interp1(1:length(temp_X),temp_X,linspace(0, length(temp_X), mean(mean_time_X(1:Bewegung+1:size(Raw_data,2)))));
    else
        H_X(:,i)=interp1(1:length(temp_X),temp_X,linspace(0, length(temp_X), 100));
    end
end

% NANs aufffüllen Im zweifel auskommentieren
H_X(1,:)=Raw_data(1,:);
for i=1:1:size(H_X,2)
    H_X(:,i)=fillgaps(H_X(:,i),3,1); %wenn Lücken gefunden werden diese ersetzen( Länge drei sample, Ordnung1)
end
warning off
i=1;
for k=1:1:size(H_X,2)/Bewegung
    H_Y(:,:,k)=H_X(:,i:1:Bewegung+i-1);
    i=i+Bewegung;
end
for i=1:1:size(H_Y,2)
    for j=1:1:size(H_Y,1)
        result_x(j,i)=mean(H_Y(j,i,:));
        result_x_std(j,i)=std(H_Y(j,i,:));
    end
end
warning on
close all
figure()
for i=1:1:Bewegung
    subplot(3,ceil(Bewegung/3),i)
    plot(result_x(:,i),'b')
    hold on
    plot(result_x(:,i)-result_x_std(:,i),'r')
    hold on
    plot(result_x(:,i)+result_x_std(:,i),'r')
    title(['column ', num2str(i)])
    if choice_mean==1
        axis([0,mean(mean_time_X(:,1)),-inf,inf]);
    else
        axis([0,100,-inf,inf]);
    end
    
end


% %% ploterei - falls nicht gwünscht aus kommentieren
% for i=2:1:Bewegung+1
%      ii=i-1:Bewegung:max_col;
% figure(i-1)
% set(gcf, 'Position', get(0, 'Screensize'));
% subplot(2,1,1)
% plot(H_X(:,ii));
% title('Interpolation aus X')
% axis([0 mean(mean_time_X(1:Bewegung+1:max_col)) -inf inf]);
% subplot(2,1,2)
% plot(result_x(:,i-1),'*r')
% hold on
% plot(result_x(:,i-1)+result_x_std(:,i-1),'*b')
% plot(result_x(:,i-1)-result_x_std(:,i-1),'*b')
% title('Mittelwert aus Interpolation aus X')
% axis([0 mean(mean_time_X(1:Bewegung+1:max_col)) -inf inf]);
% end

k=1;
for i=1:1:Bewegung
    H(:,k)=result_x(:,i);
    H(:,k+1)=result_x_std(:,i);
    k=k+2;
end

dlmwrite('mean_X.csv',H,';');
%filename_Bild=['Bewegung_' num2str(i-1) '.fig']
%savefig(filename_Bild)
%filename_Bild=['Bewegung_' num2str(i-1) '.svg']
%savesvg(filename_Bild)
%filename_Bild=['Bewegung_' num2str(i-1) '.jpg']
%savejpg(filename_Bild)