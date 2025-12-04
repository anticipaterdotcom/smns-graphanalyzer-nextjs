%   Graph Analyzer v. 2018.11.23
%       + FrontEnd (graph calculator "GC")
%       + manuelle Extrema-Bestimmung
%       + Korrektur
%       + define pattern before digitizing
%       + Ausgabe in eine Datei
%       + fakultative Referenzausgabe
%       + Anzeige doppelter Extrema
%       + mean trendline (MT)
%       + BackEnd (stickfigure movie maker "SMM")
% das Auswahl der Werte wird durch ENTER bestätigt (Reihenfolge: Maxima dann Minima)
% starten, mit a Grafik aufrufen
%  mit esc können Maxima bearbeitet werden
% (linke Maustaste hinzufügen, rechte Maustatse löschen)
%  q wechsel auf Minima
%  mit esc können Maxima bearbeitet werden
% (linke Maustaste hinzufügen, rechte Maustatse löschen)
% mit q Taste beenden und Programm ließt die gewählten Maxima und Minima
% aus ESC-Taste drücken, Programm wird beendet und speichert sie als csv Datei
% Frage Maxima oder Minima --> speichert alle Daten zwischen den Bereichen
% ab und speichert als csv Datei

%%%%
%To DO
%#1)   revisted the code in its full beauty
%#2)   rewrite the redefine / analyse function, so you can use just one function
%       for both cases
%#3)   get rid of the hebi key thing, it's just a pain in the ass to work
%       with - you often need some pauses so the code doesn't freeze - just get rid
%       of it
%#4)    the ginput thing is the same, on my machine its a bit slow - well i'm not
%       just running matlab but this should change - i mean, it is not a hack
%       of coding behind the ginput thing
%#5)    port the whole thing to a object oriented code - maybe you could save
%       some time and lines for the whole event thing
%#6)    mind the DAU dumbest available user, their is no test if the input
%       is plausible or not, i took care of it, by using as less input als
%       pausible ( only button e.g.)
%#7)    to be continue.........
%
%  @>--}--- CannibalManu ---{--<@



clear all
close all
clc

javaaddpath("matlab-input-1.2.jar")
statemain=1;
while statemain~=0 % Analysing, choosing, saving
    statusmain = mainchoosedialog();
    if isempty(statusmain)
        disp('Dialog wurde geschlossen oder ein Fehler ist aufgetreten.');
        break; % Beendet die Schleife, wenn das Dialogfenster geschlossen wird oder ein Fehler auftritt
    end
    switch statusmain
        case 'Graph_Analyzer'
    % Morphfaktor für Boxen beim Plotten (wird später benutzt)
    morph = 0.05;

    % Abfrage: Mit vorhandenem Savepoint weitermachen?
    answerSavepoint = questdlg('Continue with existing savepoint?', 'Continue', 'Yes', 'No', 'No');
    
    % Prüfung: Hat der Nutzer das Fenster abgebrochen (auf X geklickt)?
    if isempty(answerSavepoint)
        disp('Abbruch durch Benutzer beim Savepoint-Dialog.');
        break; % Oder: return;  --> Hauptschleife verlassen
    end

    if strcmp(answerSavepoint, 'Yes')
        % Dialog: Welche MAT-Datei soll geladen werden?
        [namesavefile, pathsavefile] = uigetfile('*.mat', 'Select a MAT file');
        if isequal(namesavefile, 0)
            disp('Abbruch durch Benutzer beim Öffnen eines Savepoints.');
            break;
        end
        % Datei laden
        load(fullfile(pathsavefile, namesavefile));
    else
        % Initialisierung, falls keine alten Daten geladen werden
        extrema = 0;

        % Dialog: Welche CSV soll geladen werden?
        [filename, filepath] = uigetfile('*.csv', 'Select CSV data file');
        if isequal(filename, 0)
            disp('Abbruch durch Benutzer beim Laden der CSV-Datei.');
            break;
        end

        % Dialog: Wohin sollen die Ergebnisse gespeichert werden?
        savepath = uigetdir(filepath, 'Select saving destination');
        if isequal(savepath, 0)
            disp('Abbruch durch Benutzer bei der Auswahl des Speicherorts.');
            break;
        end

        % Eingabedialog für Analyse-Parameter (Spalte, Abstand, Frequenz)
        prompt = {'Input column to analyse (number):', ...
                  'Input minimum distance between extrema (number):', ...
                  'Input frequency (Hz):'};
        dlg_title = 'Input parameters';
        num_lines = 1;
        defaultans = {'', '', ''};
        answer = inputdlg(prompt, dlg_title, num_lines, defaultans);

        % Prüfung: Wurde der Eingabedialog abgebrochen?
        if isempty(answer)
            disp('Abbruch durch Benutzer im Eingabedialog.');
            break;
        end

        % Prüfung auf gültige Eingaben (alle Felder müssen ausgefüllt sein)
        if any(cellfun(@isempty, answer))
            disp('Ungültige Eingaben. Bitte alle Felder ausfüllen!');
            break;
        end

        % CSV-Daten einlesen
        Raw_Data = dlmread(fullfile(filepath, filename), ';');

        % Zusatz: 100 Zeilen mit Nullen am Anfang UND Ende hinzufügen
        [rows, columns] = size(Raw_Data);
        New_Data = zeros(rows + 200, columns);    % 200 Zeilen mehr (Puffer)
        New_Data(101:end-100, :) = Raw_Data;      % Echte Daten werden verschoben (ab Zeile 101)
        Raw_Data = New_Data;

        % Parameter für spätere Analysen und Zeiteinheiten
        freq = str2double(answer{3});
        if isnan(freq) || freq <= 0
            disp('Ungültige Frequenz. Abbruch.');
            break;
        end
        time_per_frame = 1 / freq;

        % Spalte auswählen und Abstand übernehmen
        column_analyse = str2double(answer{1});
        distance = str2double(answer{2});
        if isnan(column_analyse) || column_analyse <= 0 || ...
           isnan(distance) || distance <= 0
            disp('Ungültige Spalten- oder Abstandsangabe. Abbruch.');
            break;
        end

        % Speichern der (jetzt vergrößerten) Größe der Datenmatrix
        [row_Raw_Data, column_Raw_Data] = size(Raw_Data);
    end
    
state=1;
while state~=0 %analysing choosing saveing
    status=choosedialog();
        if isempty(status) || strcmp(status, '')
        disp('Abbruch durch Benutzer!');
        break;   % Beendet die while-Schleife komplett
        end
    switch status
        case 'Display'
            figure()
            set(gcf, 'Position', get(0, 'Screensize'));
            plot(Raw_Data(:,column_analyse),'-r');
            title(['Raw-Data from column ',num2str(column_analyse)])
            ylabel('Elongation [a.u.]')
            xlabel('timestep')
            disppath=[savepath, '\raw_data_col_',num2str(column_analyse)];
            mkdir(disppath)
            print([disppath,'\Raw_data_column_',num2str(column_analyse)],'-dsvg')
            print([disppath,'\Raw_data_column_',num2str(column_analyse)],'-dbmp')
            savefig([disppath,'\Raw_data_column_',num2str(column_analyse)]);
%            sound(save_sound,save_sound_fs)
            state=1;
            clc;


        case 'Analyse'
            
            % case
            %  keine save daten -done
            %  Savedaten
            %   |-ghost savedaten max - done
            %   |-ghost savedaten min
            %
            if extrema(1,1) ~= 0
                j=1;
                h=1;
                for i=1:1:size(extrema,1)
                    if extrema(i,3)==1
                        max_extrema(j,1:2)=extrema(i,1:2);
                        j=j+1;
                    else
                        min_extrema(j,1:2)=extrema(i,1:2);
                        h=h+1;
                    end
                end
                [maxima_temp, maxima_tag_temp,~]=finding_extrema_in_plot(Raw_Data(:,column_analyse),distance,10,'max',max_extrema);
                extrema_max=[maxima_temp, maxima_tag_temp; max_extrema];
                [minima_temp, minima_tag_temp,~]=finding_extrema_in_plot(Raw_Data(:,column_analyse),distance,10,'min',[extrema_max;min_extrema]);
                extrema_min=[minima_temp, minima_tag_temp; min_extrema];
                pause(0.01);
                extrema=[extrema_max(:,1:2), ones(length(extrema_max),1);extrema_min(:,1:2), zeros(length(extrema_min),1)];
            else
                [maxima, maxima_tag,~]=finding_extrema_in_plot(Raw_Data(:,column_analyse),distance,10,'max',[0]);
                [minima, minima_tag,~]=finding_extrema_in_plot(Raw_Data(:,column_analyse),distance,10,'min',[maxima,maxima_tag]);
                pause(0.01);
                extrema=[maxima, maxima_tag, ones(length(maxima),1);minima, minima_tag, zeros(length(minima),1)];
            end
            extrema=sortrows(extrema,2);
            % killing duplicates
            i=1;
            while i<size(extrema,1)-1
                if extrema(i,2) == extrema (i+1,2)
                    extrema(i+1,:)=[];
                end
                i=i+1;
            end
            
            figure()
            plot(Raw_Data(:,column_analyse),'-r')
            hold on
            for i=1:1:size(extrema,1)
                if extrema(i,3) == 1
                    plot(extrema(i,2),extrema(i,1),'ob','MarkerSize',15)
                else
                    plot(extrema(i,2),extrema(i,1),'om','MarkerSize',15)
                end
                hold on
            end
            
            for i=1:1:length(extrema)-1
                if mod(i,2) == 1
                    plot([extrema(i,2),extrema(i+1,2)],[extrema(i,1),extrema(i+1,1)],'-k')
                else
                    plot([extrema(i,2),extrema(i+1,2)],[extrema(i,1),extrema(i+1,1)],':k')
                end
                hold on
                if extrema(i,1) == extrema(i+1,1)
                    plot(extrema(i,2),extrema(i,1),'*y')
                    hold on
                end
                
            end
            set(gcf, 'Position', get(0, 'Screensize'));
            title(['analysed-Data from column ',num2str(column_analyse)])
            ylabel('Elongation [a.u.]')
            xlabel('timestep')
            analpath=[savepath, '\analysed_data_col_',num2str(column_analyse)'];
            mkdir(analpath)
            print([analpath,'\analysed_data_column_',num2str(column_analyse)],'-dsvg')
            print([analpath,'\analysed_data_column_',num2str(column_analyse)],'-dbmp')
            savefig([analpath,'\analysed_data_column_',num2str(column_analyse)]);
            % sound(save_sound,save_sound_fs)
            state=1;
            clc;


        case 'Redefine'
            if exist('extrema','var')
                [maxima, maxima_tag]=redefine_extrema_in_plot(Raw_Data(:,column_analyse),[maxima, maxima_tag],20,'max');
                [minima, minima_tag]=redefine_extrema_in_plot(Raw_Data(:,column_analyse),[minima, minima_tag],20,'min');
                pause(0.01);
                extrema=[maxima, maxima_tag, ones(length(maxima),1);minima, minima_tag, zeros(length(minima),1)];
                extrema=sortrows(extrema,2);
                % killind=g duplicates
                h=1;
                while h<size(extrema,1)-1
                    if extrema(h,2) == extrema (h+1,2)
                        extrema(h+1,:)=[];
                    end
                    h=h+1;
                end
                figure()
                plot(Raw_Data(:,column_analyse),'-r')
                hold on
                for i=1:1:size(extrema,1)
                    if extrema(i,3) == 1
                        plot(extrema(i,2),extrema(i,1),'ob','MarkerSize',15)
                    else
                        plot(extrema(i,2),extrema(i,1),'om','MarkerSize',15)
                    end
                    hold on
                end
                
                for i=1:1:length(extrema)-1
                    if mod(i,2) == 1
                        plot([extrema(i,2),extrema(i+1,2)],[extrema(i,1),extrema(i+1,1)],'-k')
                    else
                        plot([extrema(i,2),extrema(i+1,2)],[extrema(i,1),extrema(i+1,1)],':k')
                    end
                    hold on
                    
                    % this case should never happen
                    if extrema(i,1) == extrema(i+1,1)
                        plot(extrema(i,2),extrema(i,1),'*y')
                        hold on
                    end
                    
                end
                set(gcf, 'Position', get(0, 'Screensize'));
                grid minor
                title(['redefined-Data from column ',num2str(column_analyse)])
                ylabel('Elongation [a.u.]')
                xlabel('timestep')
                redefinepath=[savepath, '\redefined_data_col_',num2str(column_analyse)'];
                mkdir(redefinepath)
                print([redefinepath ,'\redefined_data_col_',num2str(column_analyse)'],'-dsvg')
                print([redefinepath ,'\redefined_data_col_',num2str(column_analyse)'],'-dbmp')
                savefig([redefinepath ,'\redefined_data_col_',num2str(column_analyse)']);
%                sound(save_sound,save_sound_fs)
            else
                warningMessage = sprintf('Run analysis first!');
                uiwait(msgbox(warningMessage));
                %sound(save_sound,save_sound_fs)
            end
            state=1;
            clc;


        case 'Continue'
            if exist('extrema','var')
                state=0;
            else
                warningMessage = sprintf('Run analysis first!');
                uiwait(msgbox(warningMessage));
                %sound(save_sound,save_sound_fs)
                state=1;
            end
            clc;
            
            % ==== 1. CSV speichern? ====
if strcmp(questdlg('Save events as CSV?','Save to CSV','Yes','No','No'),'Yes')
    clc;
    pattern_analysed = choosedialog_pattern;
    if isempty(pattern_analysed)
    disp('Abbruch durch Benutzer (X gedrückt oder keine Auswahl).');
    return; % Oder break/continue je nach Schleife, springt ins Hauptmenü!
    end
    j=1;
    extrema_abs = []; % Initialisieren!
    for i=1:length(extrema)-2
        if (extrema(i,3) == str2double(pattern_analysed(1))) && ...
                (extrema(i+1,3) == str2double(pattern_analysed(2))) && ...
                (extrema(i+2,3) == str2double(pattern_analysed(3)))
            extrema_abs(j) = extrema(i+2,2) - extrema(i,2);
            j = j+1;
        end
    end
    if ~isempty(extrema_abs)
        extrema_save = zeros(max(extrema_abs), 1);
    else
        extrema_save = [];
    end
    j=1;
    for i=1:1:length(extrema)-2
        if (extrema(i,3) == str2double(pattern_analysed(1))) && ...
                (extrema(i+1,3) == str2double(pattern_analysed(2))) && ...
                (extrema(i+2,3) == str2double(pattern_analysed(3)))
            extrema_save(1:1:length(Raw_Data(extrema(i,2):1:extrema(i+2,2),column_analyse)),j) = ...
                Raw_Data(extrema(i,2):1:extrema(i+2,2),column_analyse);
            j = j+1;
        end
    end
    extrema_path = [savepath, '\events_', num2str(column_analyse), '.csv'];
    dlmwrite(extrema_path, extrema_save, ';');
    
    % Parameter-CSV erzeugen
    Parameter = cell(1, 12);
    if str2double(pattern_analysed(1)) == 0
        Parameter(1,:) = {'start value', 'start time', 'inflexion value', 'time at inflexion', ...
                          'end value', 'end time', 'shift start to inflexion', 'shift inflexion to end', ...
                          'time start to inflexion', 'time inflexion to end', 'cycle time', 'Pattern:lowHighlow'};
    else
        Parameter(1,:) = {'start value', 'start time', 'inflexion value', 'time at inflexion', ...
                          'end value', 'end time', 'shift start to inflexion', 'shift inflexion to end', ...
                          'time start to inflexion', 'time inflexion to end', 'cycle time', 'Pattern:HighlowHigh'};
    end

    i = 2;
    for k=1:2:length(extrema)-2
        if (extrema(k,3) == str2double(pattern_analysed(1))) && ...
                (extrema(k+1,3) == str2double(pattern_analysed(2))) && ...
                (extrema(k+2,3) == str2double(pattern_analysed(3)))
            Parameter(i,1) = {extrema(k,1)};
            Parameter(i,2) = {extrema(k,2)*time_per_frame};
            Parameter(i,3) = {extrema(k+1,1)};
            Parameter(i,4) = {extrema(k+1,2)*time_per_frame};
            Parameter(i,5) = {extrema(k+2,1)};
            Parameter(i,6) = {extrema(k+2,2)*time_per_frame};
            Parameter(i,7) = {abs(extrema(k,1)-extrema(k+1,1))};
            Parameter(i,8) = {abs(extrema(k+2,1)-extrema(k+1,1))};
            Parameter(i,9) = {((extrema(k+1,2)-extrema(k,2))*time_per_frame)};
            Parameter(i,10)= {((extrema(k+2,2)-extrema(k+1,2))*time_per_frame)};
            Parameter(i,11)= {((extrema(k+2,2)-extrema(k,2))*time_per_frame)};
            i = i+1;
        end
    end
    filename_parameter = [savepath, '\column_' num2str(column_analyse) '_Parameter.csv'];
    cell2csv(filename_parameter, Parameter, ';', 'Decimal', '.');
end

% ==== 2. MATLAB-Savepoint speichern? ====
if strcmp(questdlg('Save a MATLAB savepoint?','Savepoint','Yes','No','No'),'Yes')
    date_savepoint = date;
    prompt = {'Input savepointname!'}; dlg_title = 'Input savepointname';
    num_lines = 1; defaultans = {''};
    answer = inputdlg(prompt,dlg_title,num_lines,defaultans);
    if ~isempty(answer)
        filename_savepoint = [savepath, '\Savepoint_', answer{1}, '_', date_savepoint, '.mat'];
        save(filename_savepoint);
    end
end
 
    end
end




%% 
%% 
% Abfrage: Daten für Mean-Trendline arrangieren?
arrangeAns = questdlg('Arrange data for Mean-Trendline?','arrange data','Yes','No','No');
if strcmp(arrangeAns, 'Yes')
    
    % Abfrage: Existierende Datei erweitern?
    extendAns = questdlg('Extend existing File?','extend','Yes','No','No');
    if isempty(extendAns) % X gedrückt
        mean_trend_choice = 0;
        return
    end

    if strcmp(extendAns, 'Yes')
        % Dateiauswahl
        [filename, filepath] = uigetfile('*.csv');
        if isequal(filename, 0) || isequal(filepath, 0)
            mean_trend_choice = 0;
            return
        end
        
        matrix_mean_trend_existing = dlmread(fullfile(filepath, filename));
        l = size(matrix_mean_trend_existing, 2);

        % Pattern auswählen
        pattern_analysed = choosedialog_pattern;
        if isempty(pattern_analysed)
            mean_trend_choice = 0;
            return
        end
        
        for i = 1:1:length(extrema)-2
            if (extrema(i,3) == str2double(pattern_analysed(1))) && ...
               (extrema(i+1,3) == str2double(pattern_analysed(2))) && ...
               (extrema(i+2,3) == str2double(pattern_analysed(3)))
                for j = 1:1:size(Raw_Data,2)
                    temp_raw = Raw_Data(extrema(i,2):extrema(i+2,2), j);
                    for k = 1:size(temp_raw,1)
                        matrix_mean_trend_existing(k, j+l) = temp_raw(k);
                    end
                end
                l = size(Raw_Data,2) + l;
            end
        end

        % Normalisierung abfragen
        normAns = questdlg('Normalize data?','normalised','Yes','No','No');
        if isempty(normAns)
            mean_trend_choice = 0;
            return
        end
        if strcmp(normAns, 'Yes')
            normalizer = matrix_mean_trend_existing(1,:);
            for i = 1:size(matrix_mean_trend_existing,1)
                for j = 1:size(matrix_mean_trend_existing,2)
                    if matrix_mean_trend_existing(i,j) ~= 0
                        matrix_mean_trend_existing(i,j) = matrix_mean_trend_existing(i,j) - normalizer(1,j);
                    end
                end
            end
        end
        dlmwrite(fullfile(filepath,filename), matrix_mean_trend_existing);

    else
        % Neue Datei erstellen
        matrix_mean_trend = zeros(max(extrema_abs), 1);
        l = 0;

        pattern_analysed = choosedialog_pattern;
        if isempty(pattern_analysed)
            mean_trend_choice = 0;
            return
        end

        for i = 1:length(extrema)-2
            if (extrema(i,3) == str2double(pattern_analysed(1))) && ...
               (extrema(i+1,3) == str2double(pattern_analysed(2))) && ...
               (extrema(i+2,3) == str2double(pattern_analysed(3)))
                for j = 1:size(Raw_Data,2)
                    temp_raw = Raw_Data(extrema(i,2):extrema(i+2,2), j);
                    for k = 1:size(temp_raw,1)
                        matrix_mean_trend(k, j+l) = temp_raw(k);
                    end
                end
                l = size(Raw_Data,2) + l;
            end
        end

        normAns = questdlg('Normalize data?','normalised','Yes','No','No');
        if isempty(normAns)
            mean_trend_choice = 0;
            return
        end
        if strcmp(normAns, 'Yes')
            normalizer = matrix_mean_trend(1,:);
            for i = 1:size(matrix_mean_trend,1)
                for j = 1:size(matrix_mean_trend,2)
                    if matrix_mean_trend(i,j) ~= 0
                        matrix_mean_trend(i,j) = matrix_mean_trend(i,j) - normalizer(1,j);
                    end
                end
            end
        end
        
        % Dateiname zum Speichern abfragen
        [file, path] = uiputfile('.csv','Save file name');
        if isequal(file,0) || isequal(path,0)
            mean_trend_choice = 0;
            return
        end
        dlmwrite(fullfile(path,file), matrix_mean_trend, ';');
    end

    mean_trend_choice = 1;
else
    mean_trend_choice = 0;
end





%%
continue_ref=1;
while continue_ref == 1
    if strcmp(questdlg('Analyze a reference?','Reference Analysis','Yes','No','No'),'Yes')
        if strcmp(questdlg('Load a reference?','Reference Analysis','Yes','No','No'),'Yes')
            [namesavefile, pathsavefile] = uigetfile('*.mat');
            load([pathsavefile,namesavefile]);
            load_state=1;
        else
            reference = 1:column_Raw_Data;
            reference = reference(column_analyse ~= reference);
            choice_ref = choosedialog_ref(reference);
            ref = choosedialog_ref(reference);
            if isempty(ref)
             continue_ref = 0;
            end

            load_state=0;
        end

        figure()
        subplot(2,1,1)
        plot(Raw_Data(:,column_analyse),'-r')
        hold on
        plot(extrema(:,2),extrema(:,1),'+')
        for i=1:1:length(extrema)-1
            
            plot([extrema(i,2),extrema(i+1,2)],[extrema(i,1),extrema(i+1,1)],'-k')
            hold on
            if extrema(i,1) == extrema(i+1,1)
                plot(extrema(i,2),extrema(i,1),'*y')
                hold on
            end
            
        end
        grid minor
        title(['analysed-Data from column ',num2str(column_analyse)])
        ylabel('Elongation [a.u.]')
        xlabel('timestep')
        subplot(2,1,2)
        plot(Raw_Data(:,str2double(choice_ref)),'-r')
        grid minor
        title(['reference-Data from column ',choice_ref])
        ylabel('Elongation [a.u.]')
        xlabel('timestep')
        hold on
        % printing boxes function
        draw_box(Raw_Data,extrema,pattern_analysed,choice_ref,morph)
        if load_state == 1
            plot(extrema_ref(:,2),extrema_ref(:,1),'+')
            hold on
        end
        set(gcf, 'Position', get(0, 'Screensize'));
        compare_save=[savepath, '\compare_col_',num2str(column_analyse),'_',num2str(choice_ref)];
        mkdir(compare_save)
        print([compare_save, '\compare_col_',num2str(column_analyse),'_',num2str(choice_ref)],'-dsvg')
        print([compare_save, '\compare_col_',num2str(column_analyse),'_',num2str(choice_ref)],'-dbmp')
        savefig([compare_save, '\compare_col_',num2str(column_analyse),'_',num2str(choice_ref)]);
        % sound(save_sound,save_sound_fs)
    
        %%
        state=1;
        while state~=0
            status=choosedialog();
                    if isempty(status) || strcmp(status, '')
        disp('Abbruch durch Benutzer!');
        break;   % Beendet die while-Schleife komplett
        end
            switch status
               case 'Continue'
    close all

    % === 1. CSV speichern? ===
    save_csv = questdlg('Save reference events as CSV?','Save reference to CSV','Yes','No','No');
    if strcmp(save_csv, 'Yes')
        clc;
        pattern_ref = choosedialog_pattern;
        if isempty(pattern_ref)
            disp('Abbruch durch Benutzer (X gedrückt oder keine Auswahl).');
            break; % oder "continue;" je nach Schleife
        end

        j=1;
        extrema_ref_abs = [];
        for i=1:length(extrema_ref)-2
            if (extrema_ref(i,3) == str2double(pattern_ref(1))) && ...
               (extrema_ref(i+1,3) == str2double(pattern_ref(2))) && ...
               (extrema_ref(i+2,3) == str2double(pattern_ref(3)))
                extrema_ref_abs(j)=extrema_ref(i+2,2)-extrema_ref(i,2);
                j=j+1;
            end
        end
        if ~isempty(extrema_ref_abs)
            extrema_save_ref=zeros(max(extrema_ref_abs),1);
        else
            extrema_save_ref = [];
        end
        j=1;
        for i=1:1:size(extrema_ref,1)-2
            if (extrema_ref(i,3) == str2double(pattern_ref(1))) && ...
               (extrema_ref(i+1,3) == str2double(pattern_ref(2))) && ...
               (extrema_ref(i+2,3) == str2double(pattern_ref(3)))
                extrema_save_ref(1:1:length(Raw_Data(extrema_ref(i,2):1:extrema_ref(i+2,2),str2double(choice_ref))),j) = ...
                    Raw_Data(extrema_ref(i,2):1:extrema_ref(i+2,2),str2double(choice_ref));
                j=j+1;
            end
        end
        extrema_path_ref=[savepath, '\events_',num2str(choice_ref),'.csv'];
        dlmwrite(extrema_path_ref,extrema_save_ref,';');

        %writing parameter
        Parameter = cell(1, 15); % ggf. anpassen
        i=2;
        for k=1:1:length(extrema_ref)-2
            if (extrema_ref(k,3) == str2double(pattern_ref(1))) && ...
               (extrema_ref(k+1,3) == str2double(pattern_ref(2))) && ...
               (extrema_ref(k+2,3) == str2double(pattern_ref(3)))
                if str2double(pattern_ref(1)) == 1
                    Parameter(1,1:6)={'Max1 in °','Max1 t','Min1 in °','Min1 t','Max2 in °','Max2 t'};
                else
                    Parameter(1,1:6)={'Min1 in °','Min1 t','Max1 in °','Max1 t','Min2 in °','Min2 t'};
                end
                Parameter(1,7:11) = {'Winkel Anfang Mitte','Winkel Mitte end','Zeit Anfang Mitte','Zeit Mitte end','Zeit Gesamt'};
                Parameter(1,12:15) = {'delay extrema 1','delay extrema 2','delay extrema 3','difference event time'};

                Parameter(i,1)= {extrema_ref(k,1)};
                Parameter(i,2)= {extrema_ref(k,2)*time_per_frame};
                Parameter(i,3)= {extrema_ref(k+1,1)};
                Parameter(i,4)= {extrema_ref(k+1,2)*time_per_frame};
                Parameter(i,5)= {extrema_ref(k+2,1)};
                Parameter(i,6)= {extrema_ref(k+2,2)*time_per_frame};
                Parameter(i,7)= {abs(extrema_ref(k,1)-extrema_ref(k+1,1))};
                Parameter(i,8)= {abs(extrema_ref(k+2,1)-extrema_ref(k+1,1))};
                Parameter(i,9)= {((extrema_ref(k+1,2)-extrema_ref(k,2))*time_per_frame)};
                Parameter(i,10)= {((extrema_ref(k+2,2)-extrema_ref(k+1,2))*time_per_frame)};
                Parameter(i,11)= {((extrema_ref(k+2,2)-extrema_ref(k,2))*time_per_frame)};
                if k < size(extrema,1)
                    Parameter(i,12)={(extrema(k,2)-extrema_ref(k,2))*time_per_frame};
                    Parameter(i,13)={(extrema(k+1,2)-extrema_ref(k+1,2))*time_per_frame};
                    Parameter(i,14)={(extrema(k+2,2)-extrema_ref(k+2,2))*time_per_frame};
                    Parameter(i,15)={((extrema(k+2,2)-extrema(k,2))*time_per_frame)-((extrema_ref(k+2,2)-extrema_ref(k,2))*time_per_frame)};
                end
                i=i+1;
            end
        end
        filename_parameter=[savepath,'\column_', choice_ref, '_Parameter.csv'];
        cell2csv(filename_parameter, Parameter,';');
    end

    % === 2. MATLAB Savepoint speichern? ===
    save_mat = questdlg('Save a MATLAB savepoint?','Savepoint','Yes','No','No');
    if strcmp(save_mat, 'Yes')
        date_savepoint=date;
        prompt = {'Input savepointname!'}; dlg_title = 'Input savepointname';
        num_lines = 1; defaultans = {''};
        answer = inputdlg(prompt,dlg_title,num_lines,defaultans);
        if ~isempty(answer)
            filename_savepoint=[savepath,'\Savepoint_ref_',answer{1},'_',date_savepoint,'.mat'];
            save(filename_savepoint);
        end
    end
           
       

    % === 3. Weitere Referenz analysieren? ===
    if strcmp(questdlg('Analyse another reference?','Continue Analysing','Yes','No','No'),'Yes')
        state=0;
        continue_ref=1;
    else
        state=0;
        continue_ref=0;
    end
            end
        end
    else
                continue_ref = 0;

    end
end
 
        

close all
state=1;
clc;


        case 'mean trends'

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

%NANs aufffüllen Im zweifel auskommentieren
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


%% ploterei - falls nicht gwünscht aus kommentieren
for i=2:1:Bewegung+1
     ii=i-1:Bewegung:max_col;
figure(i-1)
set(gcf, 'Position', get(0, 'Screensize'));
subplot(2,1,1)
plot(H_X(:,ii));
title('Interpolation aus X')
axis([0 mean(mean_time_X(1:Bewegung+1:max_col)) -inf inf]);
subplot(2,1,2)
plot(result_x(:,i-1),'*r')
hold on
plot(result_x(:,i-1)+result_x_std(:,i-1),'*b')
plot(result_x(:,i-1)-result_x_std(:,i-1),'*b')
title('Mittelwert aus Interpolation aus X')
axis([0 mean(mean_time_X(1:Bewegung+1:max_col)) -inf inf]);
pause (2)

% Definieren der Frage und Optionen für das Dialogfeld
choice = questdlg('Möchten Sie die Datei speichern?', ...
	'Datei speichern', ...
	'Ja','Nein','Ja');

% Überprüfen der Benutzerantwort
switch choice
    case 'Ja'
      % Benutzer auffordern, ein Verzeichnis auszuwählen
savepath = uigetdir;
if savepath == 0
    error('Kein Verzeichnis ausgewählt. Der Vorgang wurde abgebrochen.');
else
    % Speichern als .fig
    filename_Bild = fullfile(savepath, ['Bewegung_' num2str(i-1) '.fig']);
    savefig(filename_Bild);
    
    % Speichern als .svg
    filename_Bild = fullfile(savepath, ['Bewegung_' num2str(i-1) '.svg']);
    saveas(gcf, filename_Bild, 'svg');
    
    % Speichern als .jpg
    filename_Bild = fullfile(savepath, ['Bewegung_' num2str(i-1) '.jpg']);
    saveas(gcf, filename_Bild, 'jpg');
end

    case 'Nein'
        disp('Speichern abgebrochen.');
end


close
end

k=1;
for i=1:1:Bewegung
    H(:,k)=result_x(:,i);
    H(:,k+1)=result_x_std(:,i);
    k=k+2;
end

dlmwrite('mean_X.csv', H, ';');
statemain=1;
clc;

    case 'Stick Movie Maker'
%clear all
close all

% Benutzer fragen, ob die Datei eine Framespalte enthält
choice = questdlg('Hat die Datei eine Framespalte?', ...
    'Framespalte', ...
    'Ja','Nein', 'Nein');

% Datei auswählen
[filename, path] = uigetfile('.csv');
if isequal(filename,0)
   disp('Benutzer hat abgebrochen');
   return;
end

try
    opts = detectImportOptions(fullfile(path, filename),'FileType', 'text');
    T = readtable(fullfile(path, filename), opts);
    if strcmp(choice, 'Ja')
    T(:, 1) = [];
    end
catch
    opts = detectImportOptions(fullfile(path, filename), 'Delimiter', ';', 'DecimalSeparator', ',');
    T = readtable(fullfile(path, filename), opts);
    if strcmp(choice, 'Ja')
    T(:, 1) = [];
    end
end

% Konvertiere Tabelle zu Array
Raw_Data = table2array(T);

% Berechnung der Grenzwerte für Achsen
max_Y = max(max(Raw_Data(:, 1:2:end)));
min_Y = min(min(Raw_Data(:, 1:2:end)));
max_X = max(max(Raw_Data(:, 2:2:end)));
min_X = min(min(Raw_Data(:, 2:2:end)));

% Initialisierung der Grafik und Wartebalken
figure;
h = waitbar(0, 'Collecting Data');

% Benutzereingabe für Anzahl der Bewegungspunkte und Linienverbindungen
prompt = {'Wie viele Bewegungspunkte gibt es?', ...
          'Welche Bewegungen sollen verbunden werden (z.B. 1 2; 3 4)?'}; %% 1 2; 2 3; 3 4; 5 6; 6 2; 7 6 z.b.
dlgtitle = 'Bewegungspunkte und Verbindungen';
dims = [1 35];
answer = inputdlg(prompt, dlgtitle, dims);

numPoints = str2double(answer{1});
linePairs = str2num(answer{2});

% Namen für Textmarkierungen
pointNames = ["Snout tip", "Backend head", "Neck", "Trunk", "Jaw tip", "Jaw joint", "Hyo"];
pointNames = pointNames(1:numPoints);

% Visualisierung der Daten
for j = 1:size(Raw_Data, 1)
    clf; hold on;
    axis([min_X max_X min_Y max_Y]);

    % Zeichnen der Verbindungslinien
    for linePair = linePairs'
    % Y-Koordinaten stehen in ungeraden Spalten: 1, 3, 5, ...
    y1 = Raw_Data(j, (linePair(1) - 1) * 2 + 1);
    y2 = Raw_Data(j, (linePair(2) - 1) * 2 + 1);
    
    % X-Koordinaten stehen in geraden Spalten: 2, 4, 6, ...
    x1 = Raw_Data(j, linePair(1) * 2);
    x2 = Raw_Data(j, linePair(2) * 2);
        plot([x1, x2], [y1, y2], '-b');
    end

    % Zeichnen der Punkte und Hinzufügen von Textmarkierungen
    for i = 1:numPoints
        x = Raw_Data(j, i*2);
        y = Raw_Data(j, i*2 - 1);
        plot(x, y, 'r+');
        text(x, y, pointNames(i));
    end

    F(j) = getframe(gcf);
    drawnow;
    hold off;
    waitbar(j/size(Raw_Data, 1), h);
end
close(h);

% Erstellen eines Videos
[filename, pathname] = uiputfile('*.avi', 'Save video as');

writerObj = VideoWriter(fullfile(pathname, filename));
writerObj.FrameRate = 24;

    % Versuchen, das Video zu öffnen
    try
        open(writerObj);
    catch ME
        error('Fehler beim Erstellen der Videodatei: %s', ME.message);
    end
    
open(writerObj);
for i = 1:length(F)
    writeVideo(writerObj, F(i));
end
close(writerObj);

statemain = 1;
clc;
    end

close all
statemain=1;
clc;
end
 


%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%                  DONT CHANGE ANYTHING DOWN HERE!!!                      %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%


% thats the box drawing function - i just didn't like to write this 5 times
% in the main code
function draw_box(Raw_Data,extrema,pattern_analysed,choice_ref,morph)
for i=1:length(extrema)-2
    if (extrema(i,3) == str2double(pattern_analysed(1))) && ...
            (extrema(i+1,3) == str2double(pattern_analysed(2))) && ...
            (extrema(i+2,3) == str2double(pattern_analysed(3)))
        h=patch([...
            extrema(i,2) ...
            extrema(i,2) ...
            extrema(i+2,2) ...
            extrema(i+2,2)],...
            [...
            min(Raw_Data(extrema(1,2):extrema(i+2,2),str2double(choice_ref)))-morph*(min(Raw_Data(extrema(1,2):extrema(i+2,2),str2double(choice_ref)))),...
            max(Raw_Data(extrema(1,2):extrema(i+2,2),str2double(choice_ref)))+morph*(max(Raw_Data(extrema(1,2):extrema(i+2,2),str2double(choice_ref)))),...
            max(Raw_Data(extrema(1,2):extrema(i+2,2),str2double(choice_ref)))+morph*(max(Raw_Data(extrema(1,2):extrema(i+2,2),str2double(choice_ref)))),...
            min(Raw_Data(extrema(1,2):extrema(i+2,2),str2double(choice_ref)))-morph*(min(Raw_Data(extrema(1,2):extrema(i+2,2),str2double(choice_ref))))...
            ],'b');
        h.FaceAlpha = 0.1;
        hold on
    else
    end
end
end


%%% this 3 beautiful old ladies are the boxes
function choice = choosedialog
    choice = '';  % Standard: "abgebrochen"
    d = dialog('Position',[300 300 250 150],'Name','');
    txt = uicontrol('Parent',d,...
        'Style','text',...
        'Position',[20 80 210 40],...
        'String','Select what you want to do next!');
    popup = uicontrol('Parent',d,...
        'Style','popup',...
        'Position',[75 70 100 25],...
        'String',{'Display';'Analyse';'Redefine';'Continue'},...
        'Callback',@popup_callback);
    btn = uicontrol('Parent',d,...
        'Position',[89 20 70 25],...
        'String','start',...
        'Callback',@start_callback);

    % Callback für X-Button (Schließen)
    d.CloseRequestFcn = @(src, event) close_callback(src);

    uiwait(d);

    function popup_callback(popup,~)
        idx = popup.Value;
        popup_items = popup.String;
        choice = char(popup_items(idx,:));
    end

    function start_callback(~,~)
        idx = popup.Value;
        popup_items = popup.String;
        choice = char(popup_items(idx,:));
        uiresume(d);
        delete(d);
    end

    function close_callback(src)
        choice = '';
        uiresume(src);
        delete(src);
    end
end

%
function choice = choosedialog_pattern
d = dialog('Position',[100 100 280 100],'Name','');

% Füge einen CloseRequestFcn hinzu, damit das Dialog korrekt auf "X" reagiert
set(d, 'CloseRequestFcn', @closeDialog);

txt = uicontrol('Parent',d,...
    'Style','text',...
    'Position',[8 69 268 15],...
    'String','Specify your pattern!');

popup = uicontrol('Parent',d,...
    'Style','popup',...
    'Position',[111 40 100 22],...
    'String',{' ';'High Low High';'Low High Low'},...
    'Callback',@popup_callback);

btn = uicontrol('Parent',d,...
    'Position',[91 9 100 22],...
    'String','Begin',...
    'Callback',@begin_callback);

choice = [];

uiwait(d);

    function popup_callback(popup,~)
        idx = popup.Value;
        popup_items = popup.String;
        switch char(popup_items(idx,:))
            case 'High Low High'
                choice = '101';
            case 'Low High Low'
                choice = '010';
            otherwise
                choice = [];
        end
    end

    function begin_callback(~,~)
        % Falls kein gültiges Pattern gewählt wurde, mache nichts
        if isempty(choice)
            % Ggf. Hinweis einblenden, falls gewünscht
            % msgbox('Please select a pattern!');
            return
        end
        delete(d)
    end

    function closeDialog(~,~)
        choice = [];  % Leerer Wert, damit im Hauptcode erkannt werden kann, dass abgebrochen wurde
        delete(d)
    end
end

%
function choice = choosedialog_ref(reference)
    choice = []; % Standardwert: leer (falls X gedrückt)
    d = dialog('Position',[100 100 280 100],'Name','', ...
               'CloseRequestFcn',@closeDialog); % eigene Schließfunktion
    txt = uicontrol('Parent',d,...
        'Style','text',...
        'Position',[8 69 268 15],...
        'String','Select a reference');
    popup = uicontrol('Parent',d,...
        'Style','popup',...
        'Position',[111 40 100 22],...
        'String',reference,...
        'Callback',@popup_callback);
    btn = uicontrol('Parent',d,...
        'Position',[91 9 100 22],...
        'String','Begin',...
        'Callback',@begin_callback);

    uiwait(d);

    function popup_callback(popup,~)
        idx = popup.Value;
        popup_items = popup.String;
        choice = char(popup_items(idx,:));
    end

    function begin_callback(~,~)
        % Wenn der Nutzer auf "Begin" klickt, Dialog schließen
        delete(d)
    end

    function closeDialog(~,~)
        % Wenn auf X geklickt: choice bleibt leer!
        choice = [];
        delete(d)
    end
end
%%% take good care of them, sometimes they bite

function choice = mainchoosedialog
persistent dialogClosed;

if isempty(dialogClosed)
    dialogClosed = false;
end

fig = figure('Position',[300 300 250 150],'Name','',...
             'MenuBar','none','NumberTitle','off',...
             'CloseRequestFcn',@closeDialog);

txt = uicontrol('Parent',fig,...
                'Style','text',...
                'Position',[20 80 210 40],...
                'String','Select what you want to do next!');

popup = uicontrol('Parent',fig,...
                  'Style','popup',...
                  'Position',[75 70 100 25],...
                  'String',{'Graph_Analyzer','mean trends','Stick Movie Maker'},...
                  'Callback',@popup_callback);
popup.Value = 1; % Vorauswahl
btn = uicontrol('Parent',fig,...
                'Position',[89 20 70 25],...
                'String','Start',...
                'Callback',@startCallback);

choice = char(popup.String(popup.Value));
uiwait(fig);

    function popup_callback(popup,~)
        idx = popup.Value;
        popup_items = popup.String;
        choice = char(popup_items(idx,:));
    end

    function startCallback(~,~)
        dialogClosed = true;
        uiresume(fig);
        delete(fig);
    end

    function closeDialog(~,~)
        choice = ''; % oder einen anderen Standardwert setzen
        dialogClosed = true;
        uiresume(fig);
        delete(fig);
    end

if ~dialogClosed
    choice = ''; % Stellen Sie sicher, dass choice einen definierten Wert hat, wenn das Dialogfenster geschlossen wird.
end
end




function [extrema, extrema_tag,kind_of_extrema]=...
    finding_extrema_in_plot(matrix,abs,epsilon,extrema_choice,previous_extrema)
% searching for extrema in matrix with spefic distance.
% can also add and delete extrema via keyboard + mouse
% matrix    -   columvector of one movement
% distance  -   distance between two extrema
% epsilon   -   since no bodys perfect, kleine epsillon umgebung um den punkt
%               den man geklickt hat
%extrema    -   will ne unterschiedung zwischen maxima und minima
close all
extrema_tag_ad = 0;
extrema_tag_del = 0;
kb = HebiKeyboard();
state = read(kb);
figure();
plot(matrix,'-r');
set(gcf, 'Position', get(0, 'Screensize'));
hold on

normalizedUnits = 'normalized'; % Ermöglicht die Positionierung relativ zur Plotgröße
uicontrol('Style', 'text', 'String', ['q - continue\  ' ...
    'c - correct  ' ...
    'right mouse - click delete  ' ...
    'left mouse - click search extrema  '], 'Units', normalizedUnits, 'Position', [0.9, 0.9, 0.1, 0.1], 'BackgroundColor', 'white');
hold on
% % Hinzufügen des Hilfetextes zum Plot
% textLocation = [0.800, 0.99]; 
% normalizedUnits = 'normalized'; % Ermöglicht die Positionierung relativ zur Plotgröße
% helpText = sprintf('q - continue\nc - correct\nright mouse - click delete\nleft mouse - click search extrema');
% text(textLocation(1), textLocation(2), helpText, 'Units', normalizedUnits, 'VerticalAlignment', 'top', 'HorizontalAlignment', 'left', 'FontSize', 10, 'BackgroundColor', 'white');

if extrema_choice == 'max'
    [extrema, extrema_tag]=findpeaks(matrix(:),'MINPEAKDISTANCE',abs);
    kind_of_extrema=1;
elseif extrema_choice == 'min'
    [extrema, extrema_tag]=findpeaks(-matrix(:),'MINPEAKDISTANCE',abs);
    extrema=-extrema;
    kind_of_extrema=-1;
end
plot(extrema_tag',extrema','*c');
grid minor
set(gcf, 'Position', get(0, 'Screensize'));
while ~state.keys('q')
    state = read(kb);
    status = 2;
    if state.keys('c')
        [extrema_tag_change, ~,status]=ginput(1);
    end
    switch status
        case 1
            extrema_tag_ad=int32(extrema_tag_change);
            if extrema_choice == 'max'
                [ ~ , extrema_tag_temp]=...
                    max(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            else
                [ ~ , extrema_tag_temp]=...
                    min(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            end
            %attention -  one click means one input maxima matrix
            extrema_tag_ad=extrema_tag_ad-epsilon+extrema_tag_temp-1;
            extrema_tag=sort([extrema_tag; extrema_tag_ad(:,1)]);
            beep;
            
        case 3
            extrema_tag_del=int32(extrema_tag_change);
            for i=1:1:length(extrema_tag)-1
                if sqrt((double(extrema_tag(i))-double(extrema_tag_del))^2)<15
                    extrema_tag(i)=[];
                    beep;
                end
            end
            %wörkaround if last point should be deleted
            if length(extrema_tag)==(i+1)
                extrema_tag(end)=[];
                beep;
            end
        otherwise
    end
    if status == 1 || status == 3
        extrema=[];
        for i=1:1:length(extrema_tag)
            extrema(i,1)= matrix(extrema_tag(i));
        end
        clf
        plot(matrix,'-r');
        hold on
        if previous_extrema(1,1) ~= 0
            plot(previous_extrema(:,2),previous_extrema(:,1),'ob','MarkerSize',15)
            hold on
        end
        plot(extrema_tag',extrema','*c');
        grid minor
        set(gcf, 'Position', get(0, 'Screensize'));
    end
    pause(0.01);
end
extrema_tag=double(extrema_tag);
close all
end

function [extrema, extrema_tag]=...
    redefine_extrema_in_plot(matrix,extrema_redefine,epsilon,extrema_choice)
close all
extrema_tag_ad = 0;
extrema_tag_del = 0;
kb = HebiKeyboard();
state = read(kb);
figure();
plot(matrix,'-r');
hold on
plot(extrema_redefine(:,2),extrema_redefine(:,1),'o', 'MarkerSize', 10, 'MarkerEdgeColor', 'k');
set(gcf, 'Position', get(0, 'Screensize'));
extrema=extrema_redefine(:,1);
extrema_tag=extrema_redefine(:,2);

normalizedUnits = 'normalized'; % Ermöglicht die Positionierung relativ zur Plotgröße
uicontrol('Style', 'text', 'String', ['q - continue\  ' ...
    'c - correct  ' ...
    'right mouse - click delete  ' ...
    'left mouse - click search extrema  '], 'Units', normalizedUnits, 'Position', [0.9, 0.9, 0.1, 0.1], 'BackgroundColor', 'white');
hold on
% % Hinzufügen des Hilfetextes zum Plot
% textLocation = [0.800, 0.99]; 
% normalizedUnits = 'normalized'; % Ermöglicht die Positionierung relativ zur Plotgröße
% helpText = sprintf('q - continue\nc - correct\nright mouse - click delete\nleft mouse - click search extrema');
% text(textLocation(1), textLocation(2), helpText, 'Units', normalizedUnits, 'VerticalAlignment', 'top', 'HorizontalAlignment', 'left', 'FontSize', 10, 'BackgroundColor', 'white');


while ~state.keys('q')
    state = read(kb);
    status = 2;
    if state.keys('c')
        [extrema_tag_change, ~,status]=ginput(1);
    end
    switch status
        case 1
            extrema_tag_ad=int32(extrema_tag_change);
            if extrema_choice == 'max'
                [ ~ , extrema_tag_temp]=...
                    max(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            else
                [ ~ , extrema_tag_temp]=...
                    min(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            end
            %attention -  one click means one input maxima matrix
            extrema_tag_ad=extrema_tag_ad-epsilon+extrema_tag_temp-1;
            extrema_tag=sort([extrema_tag; extrema_tag_ad(:,1)]);
            beep;
            
        case 3
            extrema_tag_del=int32(extrema_tag_change);
            for i=1:1:length(extrema_tag)-1
                if sqrt((double(extrema_tag(i))-double(extrema_tag_del))^2)<15
                    extrema_tag(i)=[];
                    beep;
                end
            end
            %wörkaround if last point should be deleted
            if length(extrema_tag)==(i+1)
                extrema_tag(end)=[];
                beep;
            end
        otherwise
    end
    if status == 1 || status == 3
        extrema=[];
        for i=1:1:length(extrema_tag)
            extrema(i,1)= matrix(extrema_tag(i));
        end
        clf
        plot(matrix,'-r');
        hold on
        plot(extrema_tag',extrema','o', 'MarkerSize', 10, 'MarkerEdgeColor', 'k');
        set(gcf, 'Position', get(0, 'Screensize'));
    end
    pause(0.01);
end
extrema_tag=double(extrema_tag);
close all
end

function [extrema, extrema_tag,kind_of_extrema]=...
    finding_extrema_in_plot_marked(matrix,abs,epsilon,extrema_ref,extrema_choice,pattern,choice_ref)
close all
extrema_tag_ad = 0;
extrema_tag_del = 0;
kb = HebiKeyboard();
state = read(kb);
figure();
plot(matrix,'-r');

uicontrol('Style', 'text', 'String', ['q - continue\  ' ...
    'c - correct  ' ...
    'right mouse - click delete  ' ...
    'left mouse - click search extrema  '], 'Units', normalizedUnits, 'Position', [0.9, 0.9, 0.1, 0.1], 'BackgroundColor', 'white');
hold on

% % Hinzufügen des Hilfetextes zum Plot
% textLocation = [0.800, 0.99]; 
% normalizedUnits = 'normalized'; % Ermöglicht die Positionierung relativ zur Plotgröße
% helpText = sprintf('q - continue\nc - correct\nright mouse - click delete\nleft mouse - click search extrema');
% text(textLocation(1), textLocation(2), helpText, 'Units', normalizedUnits, 'VerticalAlignment', 'top', 'HorizontalAlignment', 'left', 'FontSize', 10, 'BackgroundColor', 'white');


grid minor
    title(['reference-Data from column ',choice_ref])
    ylabel('Elongation [a.u.]')
    xlabel('timestep')
    hold on
    for i=1:length(extrema_ref)-2
        if (extrema_ref(i,3) == str2num(pattern(1))) && ...
                (extrema_ref(i+1,3) == str2num(pattern(2))) && ...
                (extrema_ref(i+2,3) == str2num(pattern(3)))
            h=patch([...
                extrema_ref(i,2) ...
                extrema_ref(i,2) ...
                extrema_ref(i+2,2) ...
                extrema_ref(i+2,2)],...
                [...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1))...
                ],'b');
            h.FaceAlpha = 0.1;
            hold on   
        else   
        end
    end 
    set(gcf, 'Position', get(0, 'Screensize'));

hold on
if extrema_choice == 'max'
    [extrema, extrema_tag]=findpeaks(matrix(:),'MINPEAKDISTANCE',abs);
    kind_of_extrema=1;
elseif extrema_choice == 'min'
    [extrema, extrema_tag]=findpeaks(-matrix(:),'MINPEAKDISTANCE',abs);
    extrema=-extrema;
    kind_of_extrema=-1;
end
plot(extrema_tag',extrema','*c');
grid minor
set(gcf, 'Position', get(0, 'Screensize'));
while ~state.keys('q')
    state = read(kb);
    status = 2;
    if state.keys('c')
        [extrema_tag_change, ~,status]=ginput(1);
    end
    switch status
        case 1
            extrema_tag_ad=int32(extrema_tag_change);
            if extrema_choice == 'max'
                [ ~ , extrema_tag_temp]=...
                    max(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            else
                [ ~ , extrema_tag_temp]=...
                    min(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            end
            %attention -  one click means one input maxima matrix
            extrema_tag_ad=extrema_tag_ad-epsilon+extrema_tag_temp-1;
            extrema_tag=sort([extrema_tag; extrema_tag_ad(:,1)]);
            beep;
            
        case 3
            extrema_tag_del=int32(extrema_tag_change);
            for i=1:1:length(extrema_tag)-1
                if sqrt((double(extrema_tag(i))-double(extrema_tag_del))^2)<15
                    extrema_tag(i)=[];
                    beep;
                end
            end
            %wörkaround if last point should be deleted
            if length(extrema_tag)==(i+1)
                extrema_tag(end)=[];
                beep;
            end
        otherwise
    end
    if status == 1 || status == 3
        extrema=[];
        for i=1:1:length(extrema_tag)
            extrema(i,1)= matrix(extrema_tag(i));
        end
        clf
        plot(matrix,'-r');
        hold on
        plot(extrema_tag',extrema','*c');
        grid minor
            for i=1:length(extrema_ref)-2
        if (extrema_ref(i,3) == str2num(pattern(1))) && ...
                (extrema_ref(i+1,3) == str2num(pattern(2))) && ...
                (extrema_ref(i+2,3) == str2num(pattern(3)))
            h=patch([...
                extrema_ref(i,2) ...
                extrema_ref(i,2) ...
                extrema_ref(i+2,2) ...
                extrema_ref(i+2,2)],...
                [...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1))...
                ],'b');
            h.FaceAlpha = 0.1;
            hold on   
        else   
        end
    end 
    set(gcf, 'Position', get(0, 'Screensize'));
        
    end
    pause(0.01);
end
extrema_tag=double(extrema_tag);
close all
end

function [extrema, extrema_tag]=...
    redefine_extrema_in_plot_marked(matrix,extrema_redefine,epsilon,extrema_choice,pattern,choice_ref,extrema_ref)
close all

%%%finding_extrema_in_plot_marked(Raw_Data(:,str2num(choice_ref)),distance,20,extrema,'max',pattern,choice_ref);
%%%finding_extrema_in_plot_marked(matrix,abs,epsilon,extrema_ref,extrema_choice,pattern,choice_ref)
extrema_tag_ad = 0;
extrema_tag_del = 0;
kb = HebiKeyboard();
state = read(kb);
figure();
plot(matrix,'-r');

uicontrol('Style', 'text', 'String', ['q - continue\  ' ...
    'c - correct  ' ...
    'right mouse - click delete  ' ...
    'left mouse - click search extrema  '], 'Units', normalizedUnits, 'Position', [0.9, 0.9, 0.1, 0.1], 'BackgroundColor', 'white');
hold on


% % Hinzufügen des Hilfetextes zum Plot
% textLocation = [0.800, 0.99]; 
% normalizedUnits = 'normalized'; % Ermöglicht die Positionierung relativ zur Plotgröße
% helpText = sprintf('q - continue\nc - correct\nright mouse - click delete\nleft mouse - click search extrema');
% text(textLocation(1), textLocation(2), helpText, 'Units', normalizedUnits, 'VerticalAlignment', 'top', 'HorizontalAlignment', 'left', 'FontSize', 10, 'BackgroundColor', 'white');


grid minor
    title(['reference-Data from column ',choice_ref])
    ylabel('Elongation [a.u.]')
    xlabel('timestep')
    hold on
    for i=1:length(extrema_ref)-2
        if (extrema_ref(i,3) == str2num(pattern(1))) && ...
                (extrema_ref(i+1,3) == str2num(pattern(2))) && ...
                (extrema_ref(i+2,3) == str2num(pattern(3)))
            h=patch([...
                extrema_ref(i,2) ...
                extrema_ref(i,2) ...
                extrema_ref(i+2,2) ...
                extrema_ref(i+2,2)],...
                [...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1))...
                ],'b');
            h.FaceAlpha = 0.1;
            hold on   
        else   
        end
    end 
plot(extrema_redefine(:,2),extrema_redefine(:,1),'+')
    set(gcf, 'Position', get(0, 'Screensize'));
hold on
extrema=extrema_redefine(:,1);
extrema_tag=extrema_redefine(:,2);
while ~state.keys('q')
    state = read(kb);
    status = 2;
    if state.keys('c')
        [extrema_tag_change, ~,status]=ginput(1);
    end
    switch status
        case 1
            extrema_tag_ad=int32(extrema_tag_change);
            if extrema_choice == 'max'
                [ ~ , extrema_tag_temp]=...
                    max(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            else
                [ ~ , extrema_tag_temp]=...
                    min(matrix(extrema_tag_ad-epsilon:1:extrema_tag_ad+epsilon));
            end
            %attention -  one click means one input maxima matrix
            extrema_tag_ad=extrema_tag_ad-epsilon+extrema_tag_temp-1;
            extrema_tag=sort([extrema_tag; extrema_tag_ad(:,1)]);
            beep;
            
        case 3
            extrema_tag_del=int32(extrema_tag_change);
            for i=1:1:length(extrema_tag)-1
                if sqrt((double(extrema_tag(i))-double(extrema_tag_del))^2)<15
                    extrema_tag(i)=[];
                    beep;
                end
            end
            %wörkaround if last point should be deleted
            if length(extrema_tag)==(i+1)
                extrema_tag(end)=[];
                beep;
            end
        otherwise
    end
    if status == 1 || status == 3
        extrema=[];
        for i=1:1:length(extrema_tag)
            extrema(i,1)= matrix(extrema_tag(i));
        end
        clf
        plot(matrix,'-r');
        hold on
        plot(extrema_tag',extrema','+');
        set(gcf, 'Position', get(0, 'Screensize'));
        
        
        plot(matrix,'-r');
grid minor
    title(['reference-Data from column ',choice_ref])
    ylabel('Elongation [a.u.]')
    xlabel('timestep')
    hold on
    for i=1:length(extrema_ref)-2
        if (extrema_ref(i,3) == str2num(pattern(1))) && ...
                (extrema_ref(i+1,3) == str2num(pattern(2))) && ...
                (extrema_ref(i+2,3) == str2num(pattern(3)))
            h=patch([...
                extrema_ref(i,2) ...
                extrema_ref(i,2) ...
                extrema_ref(i+2,2) ...
                extrema_ref(i+2,2)],...
                [...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                max(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1)),...
                min(matrix(extrema_ref(1,2):extrema_ref(i+2,2),1))...
                ],'b');
            h.FaceAlpha = 0.1;
            hold on   
        else   
        end
    end 
    hold on 
    plot(extrema_tag',extrema','+');
    set(gcf, 'Position', get(0, 'Screensize'));

    end
    pause(0.01);
end
extrema_tag=double(extrema_tag);
close all
end
















